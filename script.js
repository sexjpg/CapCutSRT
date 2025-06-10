(() => {
	let $ = document.querySelector.bind(document),
		$$ = document.querySelectorAll.bind(document),
		fileInput = $("#fileInput"),
		filePath = $("#filePath"),
		srtContent = $("#srtContent"),
		makeBtn = $("#makeSrtBtn"),
		saveBtn = $("#save-btn"),
		saveAsBtn = $("#saveAsFilePicker");

	function formatTime(t) {
		t +=
			1e6 *
			(60 *
				(60 * (parseInt($("#offset_hour").value) || 0) +
					(parseInt($("#offset_min").value) || 0)) +
				(parseInt($("#offset_second").value) || 0) +
				(parseInt($("#offset_frame").value) || 0) /
					(parseInt($("#offset_frames").value) || 25));

		let ms = (t = Math.floor(t / 1e3)) % 1e3,
			sec = (t = Math.floor(t / 1e3)) % 60,
			min = (t = Math.floor(t / 60)) % 60,
			hr = d((t = Math.floor(t / 60)), 2);

		return hr + ":" + d(min, 2) + ":" + d(sec, 2) + "," + d(ms, 3);
	}

	function d(e, t) {
		return e.toString().padStart(t, "0");
	}

	function saveFile(download = true) {
		let content = srtContent.value || srtContent.innerText;
		if (!content.trim()) return alert("尚未生成字幕文本"), false;

		let filename = $("#filename").value || "jianyin_srt";
		const typeInput = $('input[name="filetype"]:checked');
		const type = typeInput ? typeInput.value : "text/plain"; // 安全默认值

		// 自动添加文件扩展名
		let extension = "";
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
				} catch (e) {
					console.error(e);
					alert("保存失败：" + e.message);
				}
			})();
		}
	}
	function filterText() {
		let content = srtContent.value || srtContent.innerText;
		if (!content) return;

		$$('[name="filter"]:checked').forEach((el) => {
			const regex = new RegExp(el.value, "gm");
			content = content.replace(regex, "");
		});

		srtContent.value = content;
	}

	function replaceText() {
		const oldText = $("#old_text").value.trim(),
			newText = $("#new_text").value.trim();
		let content = srtContent.value || srtContent.innerText;

		if (!content || !oldText) return;

		const regex = new RegExp(oldText, "gm");
		content = content.replace(regex, newText);
		srtContent.value = content;
	}

	function generateSRT(data) {
		try {
			let texts = {},
				materials = data.materials,
				textMaterials = materials.texts;

			for (let key in textMaterials) {
				let content = textMaterials[key].content;
				try {
					content = JSON.parse(content).text;
				} catch (e) {}
				texts[textMaterials[key].id] = { content: content };
			}

			let segments = [];
			if (data.tracks && data.tracks.length) {
				data.tracks.forEach((track) => {
					if (track.segments) {
						segments = segments.concat(track.segments);
					}
				});
			}

			segments.sort(
				(a, b) => a.target_timerange.start - b.target_timerange.start
			);

			let result = [],
				startIndex = parseInt($("#start_index").value) || 0,
				count = 0;

			segments.forEach((segment) => {
				let text = texts[segment.material_id];
				if (text) {
					text.start = formatTime(segment.target_timerange.start);
					text.end = formatTime(
						segment.target_timerange.start +
							segment.target_timerange.duration -
							1
					);
					text.index = startIndex + count++;
					result.push(text);
				}
			});

			// 自动填充文件名
			if (materials.videos && materials.videos.length) {
				$("#filename").value = materials.videos[0].material_name
					.split(".")
					.slice(0, -1)
					.join(".");
			} else if (materials.audios && materials.audios.length) {
				$("#filename").value = materials.audios[0].name
					.split(".")
					.slice(0, -1)
					.join(".");
			}

			// 生成SRT内容
			let srtText = "";
			result.forEach((item) => {
				srtText += `${item.index + 1}\n${item.start} --> ${item.end}\n${
					item.content
				}\n\n`;
			});

			// srtContent.value = srtText.trim();
			srtContent.innerText = srtText.trim();
			console.log("生成字幕内容：", srtText); // 调试用日志
			return true;
		} catch (e) {
			console.error(e);
			alert("解析失败，请确认是有效的剪映项目文件");
			return false;
		}
	}

	// 初始化过滤器
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

    // 启用生成字幕按钮
    makeBtn.disabled = false;

    // 可选：清空替换文本框
    $("#old_text").value = '';
    $("#new_text").value = '';

    // 可选：取消所有过滤器选中状态
    $$('[name="filter"]').forEach(el => el.checked = false);

    console.log("已重置至初始状态");
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
				if (generateSRT(data)) {
					makeBtn.disabled = true;
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

	makeBtn.addEventListener("click", () => {
		const file = fileInput.files[0];
		if (!file) {
			alert("请先选择文件");
			return;
		}

		const reader = new FileReader();
		reader.onload = function (e) {
			try {
				const data = JSON.parse(e.target.result);
				generateSRT(data);
			} catch (e) {
				alert("文件解析失败");
			}
		};
		reader.readAsText(fileInput.files[0]);
	});




	saveBtn.addEventListener("click", () => {
        saveFile(true);
        resetProcess();
    });
	saveAsBtn.addEventListener("click", () => saveFile(false));
	$("#filterBtn").addEventListener("click", filterText);
	$("#replaceBtn").addEventListener("click", replaceText);

	// DOM加载完成后初始化
	document.addEventListener("DOMContentLoaded", function () {
		initFilters();
		// 启用保存按钮
		if (window.showSaveFilePicker) {
			saveAsBtn.style.display = "inline-block";
		}
        // 新增的事件绑定
        $("#resetBtn").addEventListener("click", resetProcess);
	});
})();
