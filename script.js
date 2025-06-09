const DRAFT_FILE_NAME = "draft_content.json";
const DEFAULT_VIDEO_NAME = "subtitles";
const ERROR_INVALID_FILE = `请选择${DRAFT_FILE_NAME}文件`;
const PROCESSING_FILE_MESSAGE = "正在处理文件...";
const NO_SUBTITLE_DATA_MESSAGE = "未找到字幕数据，请确保文件包含字幕信息。";

let subtitles = [];
let videoName = DEFAULT_VIDEO_NAME; // 默认文件名

// 获取DOM元素
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const exportSrt = document.getElementById("exportSrt");
const exportTxt = document.getElementById("exportTxt");
const preview = document.getElementById("preview");
const filePath = document.getElementById("filePath");
const fileNameInput = document.getElementById("fileName");
const replaceFrom = document.getElementById("replaceFrom");
const replaceTo = document.getElementById("replaceTo");
const applyReplace = document.getElementById("applyReplace");
const timeOffset = document.getElementById("timeOffset");
const applyTimeOffset = document.getElementById("applyTimeOffset");
const resetButton = document.getElementById("resetButton"); // 新增重置按钮引用

// 重置功能
function resetAll() {
	subtitles = [];
	videoName = DEFAULT_VIDEO_NAME;
	fileInput.value = ""; // 清空文件输入
	filePath.textContent = ""; // 清空文件路径显示
	fileNameInput.value = ""; // 清空文件名输入
	replaceFrom.value = ""; // 清空替换源文本
	replaceTo.value = ""; // 清空替换目标文本
	timeOffset.value = ""; // 清空时间偏移
	preview.innerHTML = ""; // 清空预览
	exportSrt.disabled = true; // 禁用导出按钮
	exportTxt.disabled = true;
}

// 重置按钮事件监听
resetButton.addEventListener("click", resetAll);

// 拖放事件处理
dropZone.addEventListener("dragover", (e) => {
	e.preventDefault();
	dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
	dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
	e.preventDefault();
	dropZone.classList.remove("dragover");
	const file = e.dataTransfer.files[0];
	if (file && file.name === DRAFT_FILE_NAME) {
		// 更新文件输入框的值
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(file);
		fileInput.files = dataTransfer.files;
		handleFile(file);
	} else {
		preview.innerHTML = ERROR_INVALID_FILE;
	}
});

fileInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (file && file.name === DRAFT_FILE_NAME) {
		handleFile(file);
	} else {
		preview.innerHTML = ERROR_INVALID_FILE;
	}
});

// 处理文件
async function handleFile(file) {
	if (!file) return;

	subtitles = [];
	preview.innerHTML = PROCESSING_FILE_MESSAGE;
	filePath.textContent = `当前文件: ${file.name}`;

	try {
		const content = await file.text();
		console.log("文件大小:", content.length, "字节");

		const data = JSON.parse(content);
		console.log("JSON解析成功，顶层键:", Object.keys(data));

		// 获取视频文件名
		if (
			data.materials &&
			data.materials.videos &&
			data.materials.videos.length > 0
		) {
			const video = data.materials.videos[0];
			if (video.material_name) {
				videoName = video.material_name.replace(/\.[^/.]+$/, "");
				console.log("找到视频文件名:", videoName);
				fileNameInput.value = videoName;
			}
		}

		extractSubtitles(data);

		if (subtitles.length > 0) {
			updatePreview();
			exportSrt.disabled = false;
			exportTxt.disabled = false;
			console.log("成功提取字幕数量:", subtitles.length);
		} else {
			preview.innerHTML = NO_SUBTITLE_DATA_MESSAGE;
			console.log(NO_SUBTITLE_DATA_MESSAGE);
		}
	} catch (error) {
		console.error("处理文件时出错:", error);
		preview.innerHTML = `处理文件时出错: ${error.message}`;
	}
}

// 提取字幕
function extractSubtitles(data) {
	console.log("开始提取字幕，数据结构:", Object.keys(data));

	// 检查不同的可能的数据结构
	if (data.materials && data.materials.texts) {
		console.log("找到materials.texts结构");
		console.log("texts数组长度:", data.materials.texts.length);

		data.materials.texts.forEach((text) => {
			if (
				text.words &&
				text.words.text &&
				text.words.start_time &&
				text.words.end_time
			) {
				// 合并所有文本
				const fullText = text.words.text.join("");
				// 使用第一个开始时间和最后一个结束时间
				const startTime = text.words.start_time[0] / 1000; // 转换为秒
				const endTime =
					text.words.end_time[text.words.end_time.length - 1] / 1000; // 转换为秒

				subtitles.push({
					start: startTime,
					end: endTime,
					text: fullText,
				});
			}
		});
	}

	console.log("提取到的字幕数量:", subtitles.length);

	// 按时间排序
	subtitles.sort((a, b) => a.start - b.start);
}

// 更新时间预览
function updatePreview() {
	const preview = document.getElementById("preview");
	preview.innerHTML = subtitles
		.map(
			(subtitle, index) => `
        <div class="subtitle-block">
            <div class="subtitle-index">${index + 1}</div>
            <div class="subtitle-time">${formatTime(
							subtitle.start
						)} --> ${formatTime(subtitle.end)}</div>
            <div class="subtitle-text">${subtitle.text.trim()}</div>
        </div>
    `
		)
		.join("");
}

// 格式化时间
function formatTime(seconds) {
	const date = new Date(seconds * 1000);
	const hours = date.getUTCHours().toString().padStart(2, "0");
	const minutes = date.getUTCMinutes().toString().padStart(2, "0");
	const secs = date.getUTCSeconds().toString().padStart(2, "0");
	const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
	return `${hours}:${minutes}:${secs},${ms}`;
}

// 应用文本替换
applyReplace.addEventListener("click", () => {
	const from = replaceFrom.value;
	const to = replaceTo.value;
	if (from && subtitles.length > 0) {
		subtitles.forEach((sub) => {
			sub.text = sub.text.replace(new RegExp(from, "g"), to);
		});
		updatePreview();
	}
});

// 应用时间偏移
applyTimeOffset.addEventListener("click", () => {
	const offset = parseFloat(timeOffset.value);
	if (!isNaN(offset) && subtitles.length > 0) {
		subtitles.forEach((sub) => {
			sub.start += offset;
			sub.end += offset;
		});
		updatePreview();
	}
});

// 导出SRT
exportSrt.addEventListener("click", () => {
	handleExport("srt");
	resetAll();
});

// 导出TXT
exportTxt.addEventListener("click", () => handleExport("txt"));

// 导出文件的主函数
function handleExport(format) {
	let content;
	let fileExtension;
	let fileType;

	if (format === "srt") {
		content = subtitles
			.map(
				(sub, index) =>
					`${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${
						sub.text
					}\n`
			)
			.join("\n");
		fileExtension = ".srt";
		fileType = "text/plain";
	} else if (format === "txt") {
		content = subtitles.map((sub) => sub.text).join("\n");
		fileExtension = ".txt";
		fileType = "text/plain";
	}

	if (content) {
		const fileName = fileNameInput.value || videoName;
		downloadFile(content, `${fileName}${fileExtension}`, fileType);
		alert(`文件已成功导出为 ${fileName}${fileExtension}！`);
	}
}

// 下载文件
function downloadFile(content, filename, type) {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
