(function () {
    if (document.getElementById('chaspark-md-injector-loaded')) {
        console.log("茶思屋 Markdown 导入助手已加载。");
        // Optionally toggle the panel here if we had a global toggle function
        // But since main.js handles the panel creation, we can just re-inject or assume it's there.
        return;
    }

    // Mark as loaded
    const marker = document.createElement('div');
    marker.id = 'chaspark-md-injector-loaded';
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    document.head.appendChild(link);

    // Inject Main Script (Page World)
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('main.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    console.log("茶思屋 Markdown 导入助手初始化完成。");
})();
