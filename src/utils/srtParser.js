/**
 * 格式化时间戳为字幕时间格式（HH:MM:SS,mmm）
 * @param {number} t - 初始时间戳（微秒）
 * @param {object} options - 偏移选项
 * @returns {string} 格式化后的时间字符串（HH:MM:SS,mmm）
 */
function formatTime(t, options = {}) {
    const {
        offset_hour = 0,
        offset_min = 0,
        offset_second = 0,
        offset_frame = 0,
        offset_frames = 25
    } = options;

    let totalOffset = 1000000 * (
        60 * (60 * offset_hour + offset_min) +
        offset_second +
        offset_frame / offset_frames
    );
    
    t += totalOffset;

    const d = (e, t) => e.toString().padStart(t, "0");

    let ms = Math.floor(t / 1000) % 1000;
    let sec = Math.floor(t / 1000000) % 60;
    let min = Math.floor(t / (60 * 1000000)) % 60;
    let hr = Math.floor(t / (3600 * 1000000));

    return `${d(hr, 2)}:${d(min, 2)}:${d(sec, 2)},${d(ms, 3)}`;
}


/**
 * 将字幕数组转换为 SRT/TXT 字符串
 * @param {Array} subtitles - 字幕对象数组
 * @param {string} format - 'srt' or 'txt'
 * @param {number} startIndex - 起始编号
 * @returns {string} 格式化后的字符串
 */
function subtitlesToString(subtitles, format = 'srt', startIndex = 1) {
    if (format === 'txt') {
        return subtitles.map(item => item.content).join('\n');
    }
    // SRT format
    return subtitles.map((item, index) => {
        return `${index + startIndex}\n${item.start} --> ${item.end}\n${item.content}\n\n`;
    }).join('');
}


function generateVideoInfos(materials) {
    const cuts = [];
    if (materials?.videos) {
        cuts.push(...materials.videos);
    }
    if (materials?.audios) {
        cuts.push(...materials.audios);
    }

    const videoInfos = {};
    let currentStartTime = 0;

    for (const video of cuts) {
        const cutName = video.material_name || video.name;
        if (videoInfos.hasOwnProperty(cutName)) {
            continue;
        }
        const duration = video.duration || 0;
        const endTime = currentStartTime + duration;

        videoInfos[cutName] = {
            start: currentStartTime,
            end: endTime,
            duration: duration,
            subtitles: [],
            srtText: ''
        };
        currentStartTime = endTime;
    }
    return videoInfos;
}


/**
 * 解析剪映JSON数据，生成字幕信息
 * @param {object} data - draft_content.json 的内容
 * @param {object} options - 时间偏移等选项
 * @returns {object} 包含所有视频和字幕信息的对象
 */
export function parseDraft(data, options = {}) {
    const { startIndex = 1 } = options;
    const materials = data.materials;
    if (!materials) {
        throw new Error("无效的剪映文件：缺少 'materials' 字段");
    }

    // 1. 初始化文本素材映射
    const textsMap = {};
    for (const key in materials.texts) {
        const textMaterial = materials.texts[key];
        let content = textMaterial.content;
        try {
            // 兼容新版剪映JSON格式
            content = JSON.parse(content).text;
        } catch (e) {
            // 忽略解析错误，使用原始内容
        }
        textsMap[textMaterial.id] = { content: content };
    }

    // 2. 收集并排序所有字幕片段
    let allSegments = [];
    data.tracks?.forEach(track => {
        if (track.segments) {
            allSegments = allSegments.concat(
                track.segments.filter(s => s.material_id && textsMap[s.material_id])
            );
        }
    });
    allSegments.sort((a, b) => a.target_timerange.start - b.target_timerange.start);

    // 3. 生成完整时间轴的字幕
    const allSubtitles = allSegments.map(segment => {
        const textData = textsMap[segment.material_id];
        const startTime = segment.target_timerange.start;
        const endTime = startTime + segment.target_timerange.duration;
        return {
            ...textData,
            start: formatTime(startTime, options),
            end: formatTime(endTime, options),
        };
    });

    // 4. 生成各视频片段信息
    const videos = generateVideoInfos(materials);
    const videoNames = Object.keys(videos);

    // 5. 为每个视频片段分配字幕
    if (videoNames.length > 0) {
        allSegments.forEach(segment => {
            const segmentStart = segment.target_timerange.start;
            for (const videoName of videoNames) {
                const video = videos[videoName];
                if (segmentStart >= video.start && segmentStart < video.end) {
                    const textData = textsMap[segment.material_id];
                    const adjustedStart = segment.target_timerange.start - video.start;
                    const adjustedEnd = adjustedStart + segment.target_timerange.duration;
                    
                    video.subtitles.push({
                        ...textData,
                        start: formatTime(adjustedStart, options),
                        end: formatTime(adjustedEnd, options),
                    });
                    break; // 片段已归属，跳出内层循环
                }
            }
        });
    }
    
    // 6. 为每个视频生成SRT文本
    for (const videoName of videoNames) {
        videos[videoName].srtText = subtitlesToString(videos[videoName].subtitles, 'srt', startIndex);
    }

    // 7. 创建"合集"字幕
    const combinedSrtText = subtitlesToString(allSubtitles, 'srt', startIndex);
    const combinedTxtText = subtitlesToString(allSubtitles, 'txt');

    const result = {
        videos: videos,
        allSubtitles: {
            subtitles: allSubtitles,
            srtText: combinedSrtText,
            txtText: combinedTxtText
        }
    };
    
    console.log('Parsed Result:', result);
    return result;
}
