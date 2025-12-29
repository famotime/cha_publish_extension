(() => {
    const UPLOAD_URL = "https://www.chaspark.com/chasiwu/media/v1/media/image/upload";

    function getCsrfTokenFromCookie() {
        const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : "";
    }

    function parseImages(md) {
        const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const list = [];
        let m;
        while ((m = regex.exec(md)) !== null) {
            list.push({ alt: m[1], relPath: m[2] });
        }
        return list;
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsText(file, "utf-8");
        });
    }

    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const arr = fr.result;
                const blob = new Blob([arr], { type: file.type || "image/*" });
                resolve(blob);
            };
            fr.onerror = reject;
            fr.readAsArrayBuffer(file);
        });
    }

    function uploadImageBlob(blob, filename) {
        return new Promise((resolve, reject) => {
            const form = new FormData();
            form.append("file", blob, filename || "image.jpg");

            const xhr = new XMLHttpRequest();
            xhr.open("POST", UPLOAD_URL, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader("x-csrf-token", getCsrfTokenFromCookie());
            xhr.setRequestHeader("x-requested-with", "XMLHttpRequest");

            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status !== 200) {
                    console.error("XHR upload failed:", xhr.status);
                    reject(new Error("Image upload failed: " + xhr.status));
                    return;
                }
                let data;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (e) {
                    console.error("Parse upload response failed:", e);
                    reject(new Error("Image upload failed: invalid JSON"));
                    return;
                }
                let url = "";
                if (data && data.data) {
                    if (data.data.imageUrl) {
                        url = data.data.imageUrl;
                    } else if (data.data.url) {
                        url = data.data.url;
                    } else if (typeof data.data === "string") {
                        url = data.data;
                    }
                }
                if (!url && data) {
                    url = data.url || data.path || "";
                }
                if (!url) {
                    console.error("No image URL in response:", data);
                    reject(new Error("Image upload failed: no URL returned"));
                    return;
                }
                resolve(url);
            };

            xhr.onerror = function () {
                console.error("XHR upload network error");
                reject(new Error("Image upload failed: network error"));
            };

            xhr.send(form);
        });
    }

    // Convert Markdown to HTML for TinyMCE
    function mdToHtml(md) {
        let html = md;
        // Convert **bold** to <strong>
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

        // Convert *italic* to <em>
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Convert # headings
        html = html.replace(/^### ([^\n]+)$/gm, "<h3>$1</h3>");
        html = html.replace(/^## ([^\n]+)$/gm, "<h2>$1</h2>");
        html = html.replace(/^# ([^\n]+)$/gm, "<h1>$1</h1>");

        // Convert MD Images to HTML Imgs
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;margin:10px 0;">');

        // Convert [link](url) to <a> (run after images to avoid matching ![alt](url))
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

        // Convert blockquotes
        html = html.replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>");
        // Merge consecutive blockquotes
        html = html.replace(/<\/blockquote>\n<blockquote>/g, "<br>");

        // Convert line breaks to paragraphs
        const blocks = html.split(/\n\n+/);
        html = blocks.map(block => {
            block = block.trim();
            if (!block) return "";
            if (block.match(/^<(h1|h2|h3|img|a|ul|ol|blockquote)/)) return block;
            return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
        }).join("\n");

        return html;
    }

    // Insert HTML into TinyMCE editor
    function insertIntoTinyMCE(htmlContent) {
        const editorId = "editor_content";
        if (window.tinymce && window.tinymce.get(editorId)) {
            window.tinymce.get(editorId).setContent(htmlContent);
            console.log("Content inserted into TinyMCE editor");
            return true;
        }

        const iframe = document.getElementById("editor_content_ifr");
        if (iframe && iframe.contentDocument) {
            const body = iframe.contentDocument.body;
            body.innerHTML = htmlContent;
            console.log("Content injected into iframe directly");
            return true;
        }

        console.error("Could not find TinyMCE editor");
        return false;
    }

    function createPanel() {
        if (document.getElementById("chaspark-md-import-panel")) return;

        const panel = document.createElement("div");
        panel.id = "chaspark-md-import-panel";

        // Added tabs for "File Mode" and "Folder Mode"
        panel.innerHTML = `
      <div class="panel-header">
        <span>茶思屋 Markdown（含图片） 导入助手</span>
        <span class="close-btn" id="md-import-close">&times;</span>
      </div>
      <div class="panel-tabs" style="display:flex;border-bottom:1px solid #e4e7ed;background:#f5f7fa;">
        <div class="tab active" data-tab="file" style="flex:1;padding:8px;text-align:center;cursor:pointer;border-bottom:2px solid #409eff;color:#409eff;font-weight:500;">方式1：选择文件</div>
        <div class="tab" data-tab="folder" style="flex:1;padding:8px;text-align:center;cursor:pointer;color:#606266;">方式2：选择项目目录</div>
      </div>
      <div class="panel-content">
        <!-- 文件模式 -->
        <div id="tab-content-file">
          <div class="form-item">
            <label>1. 选择 Markdown 文件 (.md)</label>
            <input id="md-file-input" type="file" accept=".md,.txt,.markdown" />
          </div>
          <div class="form-item">
            <label>2. 选择图片根目录 (可选)</label>
            <input id="img-dir-input" type="file" webkitdirectory directory />
            <div class="hint">如果 md 引用了本地图片（如 assets 文件夹），请选择其所在目录。</div>
          </div>
        </div>

        <!-- 目录模式 -->
        <div id="tab-content-folder" style="display:none;">
          <div class="form-item">
            <label>选择项目根目录</label>
            <input id="project-dir-input" type="file" webkitdirectory directory />
            <div class="hint">包含 .md 文件和图片资源的目录，脚本将自动查找第一个 .md 文件。</div>
          </div>
        </div>

        <div id="md-import-status" class="status-box">准备就绪</div>
      </div>
      <div class="panel-footer">
        <button id="md-import-run" class="btn btn-primary">开始上传并填充</button>
      </div>
    `;

        document.body.appendChild(panel);

        const closeBtn = panel.querySelector("#md-import-close");
        const statusEl = panel.querySelector("#md-import-status");
        const runBtn = panel.querySelector("#md-import-run");

        const mdFileInput = panel.querySelector("#md-file-input");
        const imgDirInput = panel.querySelector("#img-dir-input");
        const projectDirInput = panel.querySelector("#project-dir-input");

        const tabs = panel.querySelectorAll(".tab");
        let currentMode = "file";

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => {
                    t.classList.remove("active");
                    t.style.borderBottom = "none";
                    t.style.color = "#606266";
                });
                tab.classList.add("active");
                tab.style.borderBottom = "2px solid #409eff";
                tab.style.color = "#409eff";
                currentMode = tab.dataset.tab;

                if (currentMode === "file") {
                    panel.querySelector("#tab-content-file").style.display = "block";
                    panel.querySelector("#tab-content-folder").style.display = "none";
                } else {
                    panel.querySelector("#tab-content-file").style.display = "none";
                    panel.querySelector("#tab-content-folder").style.display = "block";
                }
            };
        });

        closeBtn.onclick = () => {
            panel.remove();
            const marker = document.getElementById('chaspark-md-injector-loaded');
            if (marker) marker.remove();
        };

        runBtn.onclick = async () => {
            statusEl.className = "status-box processing";
            statusEl.textContent = "正在处理...";
            runBtn.disabled = true;

            try {
                let mdFile, imgFiles = [];

                if (currentMode === "file") {
                    // 文件模式逻辑
                    if (!mdFileInput.files[0]) {
                        throw new Error("请先选择 Markdown 文件");
                    }
                    mdFile = mdFileInput.files[0];
                    imgFiles = imgDirInput.files;
                } else {
                    // 目录模式逻辑
                    if (!projectDirInput.files.length) {
                        throw new Error("请先选择项目目录");
                    }

                    // 查找第一个 markdown 文件
                    for (const f of projectDirInput.files) {
                        if (f.name.endsWith(".md") || f.name.endsWith(".markdown")) {
                            mdFile = f;
                            break;
                        }
                    }

                    if (!mdFile) {
                        throw new Error("所选目录中未找到 Markdown 文件");
                    }

                    imgFiles = projectDirInput.files;
                    statusEl.textContent = `找到文档: ${mdFile.name}`;
                }

                // --- 通用逻辑 ---

                // 1. 读取 Markdown
                let md = await readTextFile(mdFile);
                const imgsInMd = parseImages(md);

                statusEl.textContent = `找到 ${imgsInMd.length} 张引用的图片`;

                // 2. 构建文件映射
                const fileMap = new Map();
                if (imgFiles && imgFiles.length > 0) {
                    for (const f of imgFiles) {
                        const rel = (f.webkitRelativePath || f.name).replace(/^[\\/]+/, "");
                        fileMap.set(rel, f);
                        const base = rel.split(/[\\/]/).pop();
                        if (!fileMap.has(base)) fileMap.set(base, f);
                    }
                }

                // 3. 上传图片
                let uploadedCount = 0;
                for (const [index, img] of imgsInMd.entries()) {
                    if (fileMap.size === 0) {
                        console.warn("未提供图片目录，跳过本地图片上传");
                        continue;
                    }

                    statusEl.textContent = `正在上传第 ${index + 1}/${imgsInMd.length} 张图片...`;

                    // 剥离查询参数 (如 ?t=123)
                    let cleanRelPath = img.relPath.split('?')[0];
                    let rel = cleanRelPath.replace(/^\.?[\\/]/, "");

                    let file =
                        fileMap.get(rel) ||
                        fileMap.get(cleanRelPath) ||
                        fileMap.get(rel.split(/[\\/]/).pop()) ||
                        fileMap.get(img.relPath); // 最后的保底

                    if (!file && currentMode === "folder") {
                        for (const [key, val] of fileMap.entries()) {
                            if (key.endsWith(rel) || key.endsWith(cleanRelPath)) {
                                file = val;
                                break;
                            }
                        }
                    }

                    if (!file) {
                        console.warn("未找到图片文件:", img.relPath);
                        continue;
                    }

                    const blob = await readImageFile(file);
                    const url = await uploadImageBlob(blob, file.name);

                    const safeAlt = img.alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const safePath = img.relPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const pattern = new RegExp("!\\[" + safeAlt + "\\]\\(" + safePath + "\\)", "g");
                    md = md.replace(pattern, "![](" + url + ")");
                    uploadedCount++;
                }

                // 4. 插入内容
                statusEl.textContent = "正在转换并插入内容...";
                let html = mdToHtml(md);

                // 确保所有 ![]() 都转换成 img 标签
                html = html.replace(/!\[\]\(([^)]+)\)/g, '<img src="$1" style="max-width:100%;height:auto;margin:10px 0;">');

                if (!insertIntoTinyMCE(html)) {
                    throw new Error("无法插入内容。请确保编辑器已完全加载。");
                }

                statusEl.className = "status-box success";
                statusEl.textContent = `成功！已上传 ${uploadedCount} 张图片并填入编辑器。`;

            } catch (e) {
                console.error(e);
                statusEl.className = "status-box error";
                statusEl.textContent = "错误: " + e.message;
            } finally {
                runBtn.disabled = false;
                runBtn.textContent = "开始上传并填充";
            }
        };
    }

    createPanel();
})();
