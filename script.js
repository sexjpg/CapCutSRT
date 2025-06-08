let subtitles = [];
let videoName = 'subtitles'; // 默认文件名

// 获取DOM元素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const exportSrt = document.getElementById('exportSrt');
const exportTxt = document.getElementById('exportTxt');
const preview = document.getElementById('preview');
const filePath = document.getElementById('filePath');
const fileNameInput = document.getElementById('fileName');
const replaceFrom = document.getElementById('replaceFrom');
const replaceTo = document.getElementById('replaceTo');
const applyReplace = document.getElementById('applyReplace');
const timeOffset = document.getElementById('timeOffset');
const applyTimeOffset = document.getElementById('applyTimeOffset');

// 拖放事件处理
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name === 'draft_content.json') {
        handleFile(file);
    } else {
        preview.innerHTML = '请选择draft_content.json文件';
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.name === 'draft_content.json') {
        handleFile(file);
    } else {
        preview.innerHTML = '请选择draft_content.json文件';
    }
});

// 处理文件
async function handleFile(file) {
    subtitles = [];
    preview.innerHTML = '正在处理文件...';
    filePath.textContent = `当前文件: ${file.name}`;
    
    try {
        const content = await file.text();
        console.log('文件大小:', content.length, '字节');
        
        const data = JSON.parse(content);
        console.log('JSON解析成功，顶层键:', Object.keys(data));
        
        // 获取视频文件名
        if (data.materials && data.materials.videos && data.materials.videos.length > 0) {
            const video = data.materials.videos[0];
            if (video.material_name) {
                // 移除文件扩展名
                videoName = video.material_name.replace(/\.[^/.]+$/, "");
                console.log('找到视频文件名:', videoName);
                fileNameInput.value = videoName;
            }
        }
        
        extractSubtitles(data);
        
        if (subtitles.length > 0) {
            updatePreview();
            exportSrt.disabled = false;
            exportTxt.disabled = false;
            console.log('成功提取字幕数量:', subtitles.length);
        } else {
            preview.innerHTML = '未找到字幕数据，请确保文件包含字幕信息。';
            console.log('未找到字幕数据，请检查文件结构');
        }
    } catch (error) {
        console.error('处理文件时出错:', error);
        preview.innerHTML = `处理文件时出错: ${error.message}`;
    }
}

// 提取字幕
function extractSubtitles(data) {
    console.log('开始提取字幕，数据结构:', Object.keys(data));
    
    // 检查不同的可能的数据结构
    if (data.materials && data.materials.texts) {
        console.log('找到materials.texts结构');
        console.log('texts数组长度:', data.materials.texts.length);
        
        data.materials.texts.forEach(text => {
            if (text.words && text.words.text && text.words.start_time && text.words.end_time) {
                // 合并所有文本
                const fullText = text.words.text.join('');
                // 使用第一个开始时间和最后一个结束时间
                const startTime = text.words.start_time[0] / 1000; // 转换为秒
                const endTime = text.words.end_time[text.words.end_time.length - 1] / 1000; // 转换为秒
                
                subtitles.push({
                    start: startTime,
                    end: endTime,
                    text: fullText
                });
            }
        });
    }
    
    console.log('提取到的字幕数量:', subtitles.length);
    
    // 按时间排序
    subtitles.sort((a, b) => a.start - b.start);
}

// 更新时间预览
function updatePreview() {
    const preview = document.getElementById('preview');
    preview.innerHTML = subtitles.map((subtitle, index) => `
        <div class="subtitle-block">
            <div class="subtitle-index">${index + 1}</div>
            <div class="subtitle-time">${formatTime(subtitle.start)} --> ${formatTime(subtitle.end)}</div>
            <div class="subtitle-text">${subtitle.text.trim()}</div>
        </div>
    `).join('');
}

// 格式化时间
function formatTime(seconds) {
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
}

// 应用文本替换
applyReplace.addEventListener('click', () => {
    const from = replaceFrom.value;
    const to = replaceTo.value;
    if (from && subtitles.length > 0) {
        subtitles.forEach(sub => {
            sub.text = sub.text.replace(new RegExp(from, 'g'), to);
        });
        updatePreview();
    }
});

// 应用时间偏移
applyTimeOffset.addEventListener('click', () => {
    const offset = parseFloat(timeOffset.value);
    if (!isNaN(offset) && subtitles.length > 0) {
        subtitles.forEach(sub => {
            sub.start += offset;
            sub.end += offset;
        });
        updatePreview();
    }
});

// 导出SRT
exportSrt.addEventListener('click', () => {
    const srtContent = subtitles.map((sub, index) => 
        `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`
    ).join('\n');
    
    const fileName = fileNameInput.value || videoName;
    downloadFile(srtContent, `${fileName}.srt`, 'text/plain');
});

// 导出TXT
exportTxt.addEventListener('click', () => {
    const txtContent = subtitles.map(sub => sub.text).join('\n');
    const fileName = fileNameInput.value || videoName;
    downloadFile(txtContent, `${fileName}.txt`, 'text/plain');
});

// 下载文件
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
} 