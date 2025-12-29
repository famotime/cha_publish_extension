chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes("chaspark.com")) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["loader.js"]
        });
    }
});
