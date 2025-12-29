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
    
    // Convert [link](url) to <a>
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // Convert # headings
    html = html.replace(/^### ([^\n]+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## ([^\n]+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# ([^\n]+)$/gm, "<h1>$1</h1>");
    
    // Convert line breaks to paragraphs
    const lines = html.split(/\n\n+/);
    html = lines.map(line => {
      line = line.trim();
      if (!line) return "";
      if (line.match(/^<[h123]|<img|<a|<ul|<ol|<blockquote/)) return line;
      return "<p>" + line + "</p>";
    }).join("\n");
    
    return html;
  }

  // Insert HTML into TinyMCE editor
  function insertIntoTinyMCE(htmlContent) {
    // Try to get TinyMCE editor instance
    const editorId = "editor_content";
    if (window.tinymce && window.tinymce.get(editorId)) {
      window.tinymce.get(editorId).setContent(htmlContent);
      console.log("Content inserted into TinyMCE editor");
      return true;
    }
    
    // Fallback: try to find the iframe and inject directly
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

    const btn = document.createElement("button");
    btn.textContent = "Import Markdown(Auto Img)";
    btn.style.position = "fixed";
    btn.style.left = "10px";
    btn.style.bottom = "10px";
    btn.style.zIndex = 99999;
    btn.style.padding = "6px 10px";
    btn.style.background = "#409eff";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "12px";

    const panel = document.createElement("div");
    panel.id = "chaspark-md-import-panel";
    panel.style.position = "fixed";
    panel.style.left = "10px";
    panel.style.bottom = "40px";
    panel.style.zIndex = 99999;
    panel.style.width = "380px";
    panel.style.maxHeight = "70vh";
    panel.style.background = "#fff";
    panel.style.border = "1px solid #ccc";
    panel.style.borderRadius = "4px";
    panel.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
    panel.style.padding = "8px";
    panel.style.fontSize = "12px";
    panel.style.display = "none";

    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">Markdown Auto Import (Direct to Editor)</div>
      <div style="margin-bottom:4px;">
        1. Select Markdown file.<br>
        2. Select image root directory.<br>
        3. Click "Upload and Fill".<br>
      </div>
      <div style="margin-bottom:4px;">
        <input id="md-file-input" type="file" accept=".md,.txt,.markdown" />
      </div>
      <div style="margin-bottom:4px;">
        <label>Image root directory:</label><br>
        <input id="img-dir-input" type="file" webkitdirectory directory />
      </div>
      <div style="margin-bottom:4px;color:#666;">
        Example: if Markdown has ![img](img/pic1.png), the selected directory must contain img/pic1.png
      </div>
      <div style="margin-bottom:6px;color:#d00;" id="md-import-status"></div>
      <div style="text-align:right;">
        <button id="md-import-run" style="padding:4px 10px;background:#67c23a;color:#fff;border:none;border-radius:3px;cursor:pointer;">Upload and Fill</button>
        <button id="md-import-close" style="padding:4px 8px;margin-left:4px;">Close</button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    btn.onclick = () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    };
    panel.querySelector("#md-import-close").onclick = () => {
      panel.style.display = "none";
    };

    const statusEl = panel.querySelector("#md-import-status");
    const runBtn = panel.querySelector("#md-import-run");

    runBtn.onclick = async () => {
      statusEl.style.color = "#d00";
      statusEl.textContent = "";
      const mdFileInput = panel.querySelector("#md-file-input");
      const imgDirInput = panel.querySelector("#img-dir-input");

      if (!mdFileInput.files[0]) {
        statusEl.textContent = "Please select Markdown file first";
        return;
      }
      if (!imgDirInput.files.length) {
        statusEl.textContent = "Please select image directory first";
        return;
      }

      runBtn.disabled = true;
      runBtn.textContent = "Processing...";

      try {
        const mdFile = mdFileInput.files[0];
        let md = await readTextFile(mdFile);
        const imgsInMd = parseImages(md);

        const fileMap = new Map();
        for (const f of imgDirInput.files) {
          const rel = (f.webkitRelativePath || f.name).replace(/^[\\/]+/, "");
          fileMap.set(rel, f);
          const base = rel.split(/[\\/]/).pop();
          if (!fileMap.has(base)) fileMap.set(base, f);
        }

        for (const img of imgsInMd) {
          let rel = img.relPath.replace(/^\.?[\\/]/, "");
          let file =
            fileMap.get(rel) ||
            fileMap.get(img.relPath) ||
            fileMap.get(rel.split(/[\\/]/).pop());

          if (!file) {
            console.warn("Image file not found:", img.relPath);
            continue;
          }

          statusEl.textContent = "Uploading: " + (file.webkitRelativePath || file.name) + " ...";
          const blob = await readImageFile(file);
          const url = await uploadImageBlob(blob, file.name);

          const safeAlt = img.alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const safePath = img.relPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = new RegExp("!\\[" + safeAlt + "\\]\\(" + safePath + "\\)", "g");
          md = md.replace(pattern, "![](" + url + ")");
        }

        // Convert Markdown to HTML
        let html = mdToHtml(md);
        
        // Insert images in HTML
        html = html.replace(/!\[\]\(([^)]+)\)/g, '<img src="$1" style="max-width:100%;height:auto;margin:10px 0;">');

        // Insert into TinyMCE editor
        if (!insertIntoTinyMCE(html)) {
          throw new Error("Could not insert into editor");
        }

        statusEl.style.color = "#409eff";
        statusEl.textContent = "Done: Images uploaded and content inserted into editor.";
      } catch (e) {
        console.error(e);
        statusEl.textContent = "Error: " + e.message;
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Upload and Fill";
      }
    };
  }

  createPanel();
})();
