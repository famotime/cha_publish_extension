/**
 * 页面加载完成后注入 loader.js 脚本
 * @param {number} tabId - 需要注入脚本的标签页 ID
 */
function injectLoaderScript(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["loader.js"]
    });
}

/**
 * 等待指定标签页加载完成后注入脚本
 * 使用 tabs.onUpdated 监听器，页面完成加载后自动注入并移除监听
 * @param {number} tabId - 需要监听的标签页 ID
 */
function injectAfterPageLoad(tabId) {
    const listener = (updatedTabId, changeInfo) => {
        // 仅在目标标签页加载完成时触发
        if (updatedTabId === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            injectLoaderScript(tabId);
        }
    };
    chrome.tabs.onUpdated.addListener(listener);
}

chrome.action.onClicked.addListener((tab) => {
    const PUBLISH_URL = "https://www.chaspark.com/#/hotspots/publish";

    if (tab.url.startsWith(PUBLISH_URL)) {
        // 已在发布页面，直接注入脚本
        injectLoaderScript(tab.id);
    } else if (tab.url.includes("chaspark.com")) {
        // 在茶思屋其他页面，重定向到发布页并自动注入
        chrome.tabs.update(tab.id, { url: PUBLISH_URL });
        injectAfterPageLoad(tab.id);
    } else {
        // 不在茶思屋，新建标签页并自动注入
        chrome.tabs.create({ url: PUBLISH_URL }, (newTab) => {
            injectAfterPageLoad(newTab.id);
        });
    }
});

