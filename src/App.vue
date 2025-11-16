<script setup>
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { parseDraft } from './utils/srtParser.js';
// import { Windows, Apple } from '@element-plus/icons-vue';

// --- Reactive State ---

// Raw file and parsed data
const draftFile = ref(null);
const draftData = ref(null);
const parsedResult = ref(null);

// UI control
const selectedVideo = ref('all'); // 'all' or video name

// Settings panel
const settings = reactive({
    // Time offset
    offset_hour: 0,
    offset_min: 0,
    offset_second: 0,
    offset_frame: 0,
    offset_frames: 25,
    // Export
    startIndex: 1,
    filetype: 'srt', // 'srt' or 'txt'
    filename: 'jianyin_srt',
    // Text replacement
    oldText: '',
    newText: '',
    // Filler words
    fillerWords: [
        "呢", "啊", "嗯", "呃", "哎", "唉", "哦", "那么", "一直",
        "就是", "所以", "然后", "什么", "那样的", "大概",
        "这样的", "可能", "这个", "那个", "这", "那么个", "这么个",
    ],
    selectedFillerWords: [],
});

// --- Computed Properties ---

const videoOptions = computed(() => {
    if (!parsedResult.value) return [];
    const videoNames = Object.keys(parsedResult.value.videos);
    return videoNames.map(name => ({ value: name, label: name }));
});

const subtitleContent = computed({
    get() {
        if (!parsedResult.value) return '';
        if (selectedVideo.value === 'all') {
            return settings.filetype === 'srt'
                ? parsedResult.value.allSubtitles.srtText
                : parsedResult.value.allSubtitles.txtText;
        }
        const video = parsedResult.value.videos[selectedVideo.value];
        return video ? (settings.filetype === 'srt' ? video.srtText : video.subtitles.map(s=>s.content).join('\n')) : '';
    },
    set(newValue) {
        // Allow editing the preview
        if (!parsedResult.value) return;
        if (selectedVideo.value === 'all') {
             if(settings.filetype === 'srt') parsedResult.value.allSubtitles.srtText = newValue;
             else parsedResult.value.allSubtitles.txtText = newValue;
        } else {
            const video = parsedResult.value.videos[selectedVideo.value];
            if (video) {
                if(settings.filetype === 'srt') video.srtText = newValue;
            }
        }
    }
});

const videoCount = computed(() => videoOptions.value.length);

// --- Methods ---

function handleFileChange(uploadFile) {
    const file = uploadFile.raw;
    if (!file || !file.name.endsWith('.json')) {
        ElMessage.error('请选择一个有效的 .json 文件');
        return;
    }
    draftFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            draftData.value = JSON.parse(e.target.result);
            processDraft();
            ElMessage.success('文件解析成功！');
        } catch (err) {
            ElMessage.error(`文件解析失败: ${err.message}`);
            reset();
        }
    };
    reader.onerror = () => {
        ElMessage.error('读取文件失败');
        reset();
    };
    reader.readAsText(file);
}

function processDraft() {
    if (!draftData.value) return;
    try {
        const options = {
            offset_hour: settings.offset_hour,
            offset_min: settings.offset_min,
            offset_second: settings.offset_second,
            offset_frame: settings.offset_frame,
            offset_frames: settings.offset_frames,
            startIndex: settings.startIndex,
        };
        parsedResult.value = parseDraft(draftData.value, options);
        selectedVideo.value = 'all';
    } catch (err) {
        ElMessage.error(`处理草稿文件失败: ${err.message}`);
        reset();
    }
}

function applyTextReplacement() {
    if (!settings.oldText) {
        ElMessage.warning('请输入要替换的文本');
        return;
    }
    const regex = new RegExp(settings.oldText, 'g');
    subtitleContent.value = subtitleContent.value.replace(regex, settings.newText);
    ElMessage.success('替换完成');
}

function applyFilter() {
    if (settings.selectedFillerWords.length === 0) {
        ElMessage.warning('请选择要删除的语气词');
        return;
    }
    const regex = new RegExp(settings.selectedFillerWords.join('|'), 'g');
    subtitleContent.value = subtitleContent.value.replace(regex, '');
    ElMessage.success('过滤完成');
}

function saveFile(content, filename) {
    if (!content || !content.trim()) {
        ElMessage.warning('没有可保存的内容');
        return;
    }
    const extension = settings.filetype === 'srt' ? '.srt' : '.txt';
    const finalFilename = filename.endsWith(extension) ? filename : filename + extension;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function saveCurrentSelection() {
    const filename = selectedVideo.value === 'all' ? '合集字幕' : selectedVideo.value;
    saveFile(subtitleContent.value, filename);
}

async function saveAllSeparately() {
    if (videoCount.value === 0) {
        ElMessage.warning('没有可供分别保存的视频字幕');
        return;
    }
    const videos = parsedResult.value.videos;
    for (const videoName in videos) {
        const content = settings.filetype === 'srt' ? videos[videoName].srtText : videos[videoName].subtitles.map(s=>s.content).join('\n');
        if (content) {
            saveFile(content, videoName.split('.')[0]); // Remove extension from video name
            await new Promise(resolve => setTimeout(resolve, 300)); // Prevent browser blocking downloads
        }
    }
    ElMessage.success('所有单集字幕已开始下载');
}

function reset() {
    draftFile.value = null;
    draftData.value = null;
    parsedResult.value = null;
    selectedVideo.value = 'all';
    
    settings.offset_hour = 0;
    settings.offset_min = 0;
    settings.offset_second = 0;
    settings.offset_frame = 0;
    settings.startIndex = 1;
    settings.filename = 'jianyin_srt';
    settings.oldText = '';
    settings.newText = '';
    settings.selectedFillerWords = [];
}

</script>

<template>
    <el-container class="main-container" direction="vertical">
        <el-header class="main-header">
            <div class="header-content">
                <div class="title-area">
                    <h1 class="title">剪映CapCut字幕提取工具</h1>
                    <div class="description">
                        <p>请将剪映CapCut导出的 <code>draft_content.json</code> 文件拖到此处，或点击上传按钮。</p>
                        <p><el-icon>
                                <Windows />
                            </el-icon> Windows
                            默认路径：<code>C:\Users\&lt;用户名&gt;\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\</code>
                        </p>
                        <p><el-icon>
                                <Apple />
                            </el-icon> MacOS
                            默认路径：<code>/Users/&lt;用户名&gt;/Movies/JianyinPro/User Data/Projects/com.lveditor.draft/</code>
                        </p>
                    </div>
                </div>
                <div class="upload-area-wrapper">
                    <el-upload drag action="#" :auto-upload="false" :show-file-list="false" @change="handleFileChange"
                        class="upload-area">
                        <el-icon class="el-icon--upload">
                            <UploadFilled />
                        </el-icon>
                        <div class="el-upload__text">
                            将 <code>draft_content.json</code> 拖到此处, 或 <em>点击上传</em>
                        </div>
                    </el-upload>
                    <div v-if="draftFile" class="file-path">当前文件: {{ draftFile.name }}</div>
                </div>
            </div>
        </el-header>

        <el-container class="content-container">
            <el-aside class="control-panel">
                <el-card shadow="never">
                    <template #header>
                        <div class="card-header">
                            <span>工具设置</span>
                        </div>
                    </template>

                    <!-- Settings -->
                    <el-collapse value="1" style="margin-top: 0;">
                        <el-collapse-item title="高级设置" name="1">

                            <!-- Time Offset -->
                            <el-divider content-position="left">时间偏移设置</el-divider>
                            <el-form label-width="40px" label-position="left" size="small">
                                <el-row :gutter="10">
                                    <el-col :span="12"><el-form-item label="时"><el-input-number
                                                v-model="settings.offset_hour" :min="0" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="分"><el-input-number
                                                v-model="settings.offset_min" :min="0" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="秒"><el-input-number
                                                v-model="settings.offset_second" :min="0" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="帧"><el-input-number
                                                v-model="settings.offset_frame" :min="0" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="帧率"><el-input-number
                                                v-model="settings.offset_frames" :min="1" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                    <el-col :span="12"><el-form-item label="起始"><el-input-number
                                                v-model="settings.startIndex" :min="0" controls-position="right"
                                                @change="processDraft" /></el-form-item></el-col>
                                </el-row>
                            </el-form>

                            <!-- Text Replacement -->
                            <el-divider content-position="left">文本替换</el-divider>
                            <el-input v-model="settings.oldText" placeholder="查找的文本" size="small"
                                style="margin-bottom: 8px;" />
                            <el-input v-model="settings.newText" placeholder="替换为" size="small"
                                style="margin-bottom: 8px;" />
                            <el-button @click="applyTextReplacement" type="primary" plain size="small"
                                style="width: 100%;">应用替换</el-button>

                            <!-- Filler Words Filter -->
                            <el-divider content-position="left">删除语气词</el-divider>
                            <el-select v-model="settings.selectedFillerWords" multiple filterable
                                placeholder="选择或输入要删除的词" size="small" style="width: 100%; margin-bottom: 8px;">
                                <el-option v-for="item in settings.fillerWords" :key="item" :label="item"
                                    :value="item" />
                            </el-select>
                            <el-button @click="applyFilter" type="primary" plain size="small"
                                style="width: 100%;">应用过滤</el-button>

                        </el-collapse-item>
                    </el-collapse>
                </el-card>
            </el-aside>

            <el-main class="preview-panel">
                <el-card shadow="never" style="height: 100%;">
                    <template #header>
                        <div class="preview-header">
                            <span>字幕预览</span>
                            <div class="action-buttons">
                                <el-button @click="saveCurrentSelection" type="primary" size="small">保存当前字幕</el-button>
                                <el-button @click="saveAllSeparately" :disabled="videoCount === 0"
                                    size="small">保存全部分轨</el-button>
                                <el-button @click="reset" size="small">重置所有</el-button>
                            </div>
                        </div>
                    </template>

                    <!-- Video Selector -->
                    <div class="video-selector-bar">
                        <span class="video-count">检测到 {{ videoCount }} 个视频片段</span>
                        <el-select v-model="selectedVideo" placeholder="选择视频" style="flex-grow: 1; margin-left: 16px;">
                            <el-option label="全部视频字幕 (合集)" value="all" />
                            <el-option v-for="opt in videoOptions" :key="opt.value" :label="opt.label"
                                :value="opt.value" />
                        </el-select>
                        <div class="header-actions">
                            <el-radio-group v-model="settings.filetype" size="small">
                                <el-radio-button label="SRT" value="srt" />
                                <el-radio-button label="TXT" value="txt" />
                            </el-radio-group>
                        </div>
                    </div>

                    <!-- Preview Textarea -->
                    <el-input v-model="subtitleContent" type="textarea" :rows="20" class="subtitle-preview"
                        placeholder="在这里预览字幕内容..." />

                    <!-- Action Buttons are now in the header -->
                </el-card>
            </el-main>
        </el-container>

        <el-footer class="main-footer">
            <!-- 底部空间预留 -->
        </el-footer>
    </el-container>
</template>

<style>
body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #f5f7fa;
}
.main-container {
    height: 100vh;
}
.main-header {
    height: auto;
    padding: 16px 20px;
    background-color: #fff;
    border-bottom: 1px solid #dcdfe6;
}
.header-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 1200px;
    margin: 0 auto;
}
.title-area {
    flex-shrink: 0;
    text-align: center;
}
.title {
    margin: 0;
    font-size: 24px;
    font-weight: bold;
}
.upload-area-wrapper {
    width: 400px;
    text-align: center;
}
.upload-area .el-upload-dragger {
    padding: 10px;
}
.content-container {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
}
.control-panel {
    width: 25%;
    max-width: 300px;
    min-width: 280px;
}
.control-panel, .preview-panel {
    height: 100%;
}
.el-card {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.el-card__body {
    flex-grow: 1;
    overflow-y: hidden;
    display: flex;
    flex-direction: column;
}
.card-header {
    font-weight: bold;
}
.file-path {
    margin-top: 8px;
    color: #999;
    font-size: 12px;
    word-break: break-all;
}
.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.header-actions {
    flex-shrink: 0;
    margin-left: 16px;
}
.video-selector-bar {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
}
.video-count {
    font-size: 14px;
    color: #606266;
    white-space: nowrap;
}
.subtitle-preview {
    font-family: monospace;
    flex-grow: 1;
    margin-bottom: 16px;
}
.subtitle-preview .el-textarea__inner {
    height: 100%;
}
.action-buttons {
    display: flex;
    justify-content: flex-end;
}
.el-form-item--small {
    margin-bottom: 8px;
}
.el-input-number--small {
    width: 100%;
}
.main-footer {
    height: 40px;
    line-height: 40px;
    text-align: center;
    background-color: #f2f2f2;
    color: #999;
    font-size: 12px;
    border-top: 1px solid #e0e0e0;
}
</style>
