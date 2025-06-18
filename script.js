// (() => {
let $ = document.querySelector.bind(document),
    $$ = document.querySelectorAll.bind(document),
    fileInput = $('#fileInput'),
    filePath = $('#filePath'),
    srtContent = $('#srtContent'),
    // makeBtn = $('#makeSrtBtn'),
    saveBtn = $('#save-btn'),
    saveAsBtn = $('#saveAsFilePicker');

const defaultsubtitle = '合集字幕'
// 全局状态变量
let draft = null;        // 当前处理的项目数据副本
let Videos = {};         // 视频时间字典
// let segments = [];       // 时间轴片段数组
// let result = [];         // 生成的字幕结果
// let texts = {};          // 文本素材映射
let filenameTemplate = '';// 文件名模板
let selectedVideo = defaultsubtitle; // 当前选中的视频
const outdata = {};

/**
 * 格式化时间戳为字幕时间格式（HH:MM:SS,mmm）
 * @param {number} t - 初始时间戳（毫秒）
 * @returns {string} 格式化后的时间字符串（HH:MM:SS,mmm）
 */
function formatTime(t) {
    // 添加用户设置的时间偏移量（小时/分钟/秒/帧）
    t +=
        1e6 *
        (60 *
            (60 * (parseInt($("#offset_hour").value) || 0) +
                (parseInt($("#offset_min").value) || 0)) +
            (parseInt($("#offset_second").value) || 0) +
            (parseInt($("#offset_frame").value) || 0) /
            (parseInt($("#offset_frames").value) || 25));

    // 时间单位转换计算
    let ms = (t = Math.floor(t / 1e3)) % 1e3,
        sec = (t = Math.floor(t / 1e3)) % 60,
        min = (t = Math.floor(t / 60)) % 60,
        hr = d((t = Math.floor(t / 60)), 2);

    return hr + ":" + d(min, 2) + ":" + d(sec, 2) + "," + d(ms, 3);
}

/**
 * 数字补零格式化函数
 * @param {number} e - 需要格式化的数字
 * @param {number} t - 结果位数
 * @returns {string} 补零后的字符串
 */
function d(e, t) {
    return e.toString().padStart(t, "0");
}

/**
 * 保存指定内容为文件（支持传入内容和文件名）
 * @param {string} [filename="jianyin_srt"] - 文件名（不含扩展名）
 * @param {string} content - 要保存的内容
 * @param {boolean} [download=true] - 是否立即下载
 * @returns {Promise} 返回一个Promise，在保存完成后resolve
 */
function saveFile(filename = "jianyin_srt", content, download = true) {
    return new Promise((resolve, reject) => {
        if (!content || !content.trim()) {
            alert("尚未生成字幕文本");
            return resolve(false);
        }

        const typeInput = $('input[name="filetype"]:checked');
        const type = typeInput ? typeInput.value : "text/plain";
        let extension = "";

        // 根据类型设置扩展名
        if (type === "application/x-subrip") {
            extension = ".srt";
        } else if (type === "text/plain") {
            extension = ".txt";
        }

        // 确保文件名包含正确扩展名
        if (!filename.toLowerCase().endsWith(extension)) {
            filename += extension;
        }

        const blob = new Blob([content], { type });

        if (download) {
            if (window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, filename);
                resolve(true);
            } else {
                const a = document.createElement("a");
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    resolve(true);
                }, 0);
            }
        } else if (window.showSaveFilePicker) {
            (async () => {
                try {
                    const handle = await window.showSaveFilePicker();
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    alert("另存成功！");
                    resolve(true);
                } catch (e) {
                    console.error(e);
                    alert("保存失败：" + e.message);
                    reject(e);
                }
            })();
        }
    });
}

/**
 * 将字幕数组转换为 SRT 字符串
 * @param {Array} subtitles - 字幕对象数组
 * @returns {string} SRT 格式的字符串
 */
function generateSRTContent(subtitles) {
    return subtitles.map((item, index) => {
        return `${index + 1}\n${item.start} --> ${item.end}\n${item.content}\n\n`;
    }).join('');
}

/**
 * 文本过滤处理函数
 * 处理用户选择的过滤规则并更新字幕内容
 */
function filterText() {
    let content = srtContent.value || srtContent.innerText;
    if (!content) return;

    // 应用所有选中的过滤规则
    $$('[name="filter"]:checked').forEach((el) => {
        const regex = new RegExp(el.value, "gm");
        content = content.replace(regex, "");
    });

    srtContent.value = content;
}

/**
 * 文本替换处理函数
 * 执行用户指定的文本替换操作
 */
function replaceText() {
    const oldText = $("#old_text").value.trim(),
        newText = $("#new_text").value.trim();
    let content = srtContent.value || srtContent.innerText;

    if (!content || !oldText) return;

    // 执行全局正则替换
    const regex = new RegExp(oldText, "gm");
    content = content.replace(regex, newText);
    srtContent.value = content;
}

/**
 * 创建视频时间字典
 * @param {Array} videos - 视频数组，每个视频对象应包含 material_name 和 duration 属性
 * @returns {Object} 视频时间字典，键为 video.material_name，值为包含 start 和 end 的时间对象
 */
function generateVideoinfos(videos) {
    const Videoinfos = {};
    let currentStartTime = 0;

    for (const video of videos) {
        // 如果该 material_name 已存在于结果中，则跳过
        if (Videoinfos.hasOwnProperty(video.material_name)) {
            continue;
        }
        // 确保视频对象有 duration 属性，若没有则默认设为 0
        const duration = video.duration || 0;
        const endTime = currentStartTime + duration;

        // 设置当前视频的开始和结束时间
        // const key = video.material_name.split(".").slice(0, -1);
        const key = video.material_name;
        Videoinfos[key] = {
            start: currentStartTime,
            end: endTime,
            duration: duration
        };

        // 更新当前开始时间为下一个视频的起始时间
        currentStartTime = endTime;
    }

    return Videoinfos;
}

function generateSRT(Videos) {
    const segments = outdata.segments;
    const texts = outdata.texts;
    const AllSub = outdata.AllSub;

    // 遍历 VideosSRT 中的每个视频并生成字幕文件
    for (const videoName in Videos) {
        if (videoName == defaultsubtitle) continue;
        const videoInfo = Videos[videoName];
        const videoStart = videoInfo.start;
        const videoEnd = videoInfo.end;

        // 为当前视频创建独立的字幕数组
        const videoSubtitles = [];

        segments.forEach((segment) => {
            const segmentStartTime = segment.target_timerange.start;
            let startIndex = parseInt($("#start_index").value) || 0;

            if (segmentStartTime >= videoStart && segmentStartTime < videoEnd) {
                let text = texts[segment.material_id];

                if (text) {
                    const adjustedStart = segment.target_timerange.start - videoStart;
                    const adjustedEnd =
                        adjustedStart + segment.target_timerange.duration - 1;

                    text.start = formatTime(adjustedStart);
                    text.end = formatTime(adjustedEnd);
                    text.index = startIndex++;

                    videoSubtitles.push(text);
                }
            }
        });

        // 存储到结果中（可选）
        videoInfo.Subtitle = videoSubtitles;
        videoInfo.srtText = generateSRTContent(videoSubtitles);
    }

    // Videos[defaultsubtitle] = { Subtitle: AllSub };
    return Videos;
}

//初始化草稿文件,获取字幕时间轴,字幕文字
function InitDraft(data) {
    outdata.data = data;
    draft = data;

    try {
        // 初始化文本素材映射
        let texts = {}
        const materials = data.materials;
        const textMaterials = materials.texts;

        for (let key in textMaterials) {
            let content = textMaterials[key].content;
            try {
                content = JSON.parse(content).text;
            } catch (e) {}
            texts[textMaterials[key].id] = { content: content };
        }

        // 收集并排序时间轴片段
        let segments = [];
        if (data.tracks && data.tracks.length) {
            data.tracks.forEach((track) => {
                if (track.segments) {
                    segments = segments.concat(track.segments);
                }
            });
        }

        // 按开始时间排序片段
        segments.sort(
            (a, b) => a.target_timerange.start - b.target_timerange.start
        );
        console.log(segments);

        // 生成整段视频字幕条目
        let AllSub = []
        let startIndex = parseInt($("#start_index").value) || 0;
        let count = 0;

        segments.forEach((segment) => {
            let text = texts[segment.material_id];
            if (text) {
                text.start = formatTime(segment.target_timerange.start);
                text.end = formatTime(
                    segment.target_timerange.start + segment.target_timerange.duration - 1);
                text.index = startIndex + count++;
                AllSub.push(text);
            }
        });

        // 整段视频的字幕内容
        let srtText = "";
        AllSub.forEach((item) => {
            srtText += `${item.index + 1}\n${item.start} --> ${item.end}\n${
                item.content
            }\n\n`;
        });
        console.log("AllSub", AllSub, srtText);

        outdata.segments = segments
        outdata.texts = texts
        outdata.AllSub = AllSub

        Videos = generateVideoinfos(materials.videos)
        Videos = generateSRT(Videos)

        Videos[defaultsubtitle]={ 
            Subtitle: AllSub,
            srtText: srtText,
            start: 0,
            end: 0,
            duration: 0
        };

        console.log('Videos', Videos)


        // 更新字幕预览
        if (typeof window.updateSubtitlePreview === 'function') {
            window.updateSubtitlePreview();
        }

        // // console.log("字幕条目：", result);


        // srtContent.innerText = srtText.trim();
        // console.debug("生成字幕内容：", srtText);
        // 更新视频选择器
        if (typeof window.initVideoSelector === 'function') {
            window.initVideoSelector();
        }

        return true;
    } catch (e) {
        console.error(e);
        alert("解析失败，请确认是有效的剪映项目文件");
        // 在出错时也确保能重新初始化视频选择器
        if (typeof window.initVideoSelector === 'function') {
            window.initVideoSelector();
        }
        return false;
    }
}

/**
 * 初始化文本过滤器界面
 * 动态生成常用语气词过滤选项
 */
function initFilters() {
    let filterHtml = "<label>删除语气词：</label>";
    [
        "呢",
        "啊",
        "嗯",
        "呃",
        "哎",
        "唉",
        "哦",
        "那么",
        "一直",
        "就是",
        "所以",
        "然后",
        "什么",
        "那样的",
        "大概",
        "这样的",
        "可能",
        "这个",
        "那个",
        "这",
        "那么个",
        "这么个",
    ].forEach((word, index) => {
        filterHtml += `
                        <span>
                            <input type="checkbox" name="filter" id="f${index}" value="${word}">
                            <label for="f${index}">${word}</label>
                        </span>`;
    });
    $("#filters").innerHTML = filterHtml;
}

/**
 * 重置所有输入和状态到初始状态
 * 清除所有用户输入和处理结果
 */
function resetProcess() {
    // 清空文件输入框
    fileInput.value = '';

    // 清除文件路径显示
    filePath.textContent = '';

    // 清除字幕预览内容
    srtContent.value = '';
    srtContent.innerText = '';

    // 重置时间偏移输入框
    $("#offset_hour").value = '0';
    $("#offset_min").value = '0';
    $("#offset_second").value = '0';
    $("#offset_frame").value = '0';
    $("#offset_frames").value = '25';

    // 重置起始编号
    $("#start_index").value = '0';

    // 重置文件名输入框
    $("#filename").value = '';
    $("#filenameTemplate").value = '';

    // 重置视频选择器
    const selector = $('#videoSelector');
    selector.innerHTML = `<option value="${selectedVideo}">全部视频字幕</option>`;
    selectedVideo = defaultsubtitle;

    // 重置时间轴预览
    // $('#timelinePreview').innerHTML = '<p style="color: #999; margin: 0;">选择视频后显示时间分布</p>';

    // 重置自动分割设置
    $("#autoSplit").checked = true;
    document.querySelector('#outputModeMerge').checked = true;

    // 启用生成字幕按钮
    // makeBtn.disabled = false;

    // 可选：清空替换文本框
    $("#old_text").value = '';
    $("#new_text").value = '';

    // 可选：取消所有过滤器选中状态
    $$('[name="filter"]').forEach(el => el.checked = false);

    // 重置全局变量

    Videos = {};
    // 视频相关数据
    currentVideos = {};
    selectedVideo = defaultsubtitle;
    filenameTemplate = '';

    const countSpan = $('#videoCount')
    countSpan.textContent = Object.keys(Videos).length;


    console.log("已重置至初始状态");
}

async function saveAllSubtitles(Videos) {
    const autoSplit = $("#autoSplit").checked;
    const outputMode = document.querySelector('input[name="outputMode"]:checked')?.value;
    const useTemplate = autoSplit && outputMode === 'separate';
    let index = 1;

    // 获取所有需要保存的视频名称
    const videoNames = Object.keys(Videos).filter(videoName =>
        Videos[videoName].srtText?.length > 0
    );

    // 使用递归函数逐个下载
    async function downloadNext(index) {
        if (index >= videoNames.length) return;

        const videoName = videoNames[index];

        if(videoName === defaultsubtitle) return;

        const videoInfo = Videos[videoName];
        const srtContent = videoInfo.srtText;

        // 使用文件名模板或视频名称作为文件名
        let filename;
        if (useTemplate && filenameTemplate) {
            filename = generateFilename(filenameTemplate, index + 1);
        } else {
            filename = videoName.split(".").slice(0, -1).join(".") || defaultsubtitle;
        }

        // 下载当前文件
        await saveFile(filename, srtContent);

        // 延迟500毫秒确保浏览器有时间处理下载
        await new Promise(resolve => setTimeout(resolve, 500));

        // 继续下一个下载
        await downloadNext(index + 1);
    }

    // 开始依次下载
    await downloadNext(0);
}

/**
 * 更新字幕预览内容
 * 根据当前选择的视频显示对应字幕
 */
function updateSubtitlePreview() {
    let srtText = "";
    // 显示指定视频字幕
    let videoSubtitles = Videos[selectedVideo]?.srtText || "";
    // 处理空字幕情况
    if (videoSubtitles.length === 0) {
        // srtContent.innerText = `未找到视频「${videoName}」的字幕信息`;
        console.log(`未找到视频「${selectedVideo}」的字幕信息`);
        srtText = `未找到视频「${selectedVideo}」的字幕信息`;
    } else {
        srtText= videoSubtitles
    }
    // 使用innerText设置contenteditable元素的内容
    // srtContent.innerText = srtText.trim();
    srtContent.innerText = srtText
    $("#filename").value = selectedVideo;
}

// 事件绑定
fileInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    filePath.textContent = file.name;
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            // 自动解析并生成预览
            if (InitDraft(data)) {
                // 自动开始生成字幕
                // makeBtn.disabled = true;
                updateSubtitlePreview();
            }
        } catch (e) {
            alert("文件解析失败，请选择有效的JSON文件");
            filePath.textContent = "";
        }
    };

    reader.onerror = function () {
        alert("读取文件失败");
    };

    reader.readAsText(file);
});

// makeBtn.addEventListener("click", () => {
//     const file = fileInput.files[0];
//     if (!file) {
//         alert("请先选择文件");
//         return;
//     }

//     const reader = new FileReader();
//     reader.onload = function (e) {
//         try {
//             const data = JSON.parse(e.target.result);
//             InitDraft(data);
//         } catch (e) {
//             alert("文件解析失败");
//         }
//     };
//     reader.readAsText(fileInput.files[0]);
// });

// 修改保存按钮的点击事件处理
saveBtn.addEventListener("click", () => {
    const autoSplit = $("#autoSplit").checked;
    const outputMode = document.querySelector('input[name="outputMode"]:checked')?.value;

    if (autoSplit && outputMode === 'separate') {
        // 如果启用自动分割且选择独立输出，则保存所有视频字幕
        saveAllSubtitles(Videos);
    } else {
        // 否则保存当前选择的字幕
        const content = srtContent.innerText || srtContent.value;
        const filename = $("#filename").value || "jianyin_srt";
        saveFile(filename, content);
    }

});
saveAsBtn.addEventListener("click", () => saveFile(false));
$("#filterBtn").addEventListener("click", filterText);
$("#replaceBtn").addEventListener("click", replaceText);
$('#saveAllVideos').addEventListener('click', () => {
    saveAllSubtitles(Videos)
});

/**
 * 初始化视频选择器
 * 根据解析的视频数据填充下拉框选项
 */
window.initVideoSelector = function () {
    const selector = $('#videoSelector');
    const countSpan = $('#videoCount');

    // 清空现有选项
    selector.innerHTML = `<option value="${defaultsubtitle}">视频合集字幕</option>`;

    // 填充视频选项
    for (const videoName in Videos) {
        if (videoName === defaultsubtitle) continue;
        const option = document.createElement('option');
        option.value = videoName;
        option.textContent = videoName;
        selector.appendChild(option);
    }

    // 更新检测到的视频数量
    countSpan.textContent = Object.keys(Videos).length;

    // 移除旧的事件监听器（如果存在）
    const oldSelector = selector.cloneNode(true);
    selector.parentNode.replaceChild(oldSelector, selector);

    // 重新获取新的select元素
    const newSelector = $('#videoSelector');

    // 绑定选择事件
    newSelector.addEventListener('change', (e) => {
        selectedVideo = e.target.value;
        updateSubtitlePreview();
    });
};

// DOM加载完成后初始化
document.addEventListener("DOMContentLoaded", function () {
    initFilters();
    if (window.showSaveFilePicker) {
        saveAsBtn.style.display = "inline-block";
    }
    $("#resetBtn").addEventListener("click", resetProcess);
    if (typeof initVideoSelector === 'function') {
        window.initVideoSelector();
    }
    $('#autoSplit').addEventListener('change', (e) => {
        const autoSplit = e.target.checked;
        document.querySelectorAll('[data-auto-split]').forEach(el => {
            el.disabled = !autoSplit;
        });
    });
    $('#filenameTemplate').addEventListener('change', (e) => {
        filenameTemplate = e.target.value;
    });
    
    // 新增折叠面板交互
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            this.classList.toggle('collapsed', isVisible);
        });
    });

    // 默认初始化折叠状态
    document.querySelectorAll('.collapsible-content').forEach(content => {
        content.style.display = 'none';
    });
});
// })();
