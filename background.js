chrome.action.onClicked.addListener((tab) => {
    const PUBLISH_URL = "https://www.chaspark.com/#/hotspots/publish";

    if (tab.url.startsWith(PUBLISH_URL)) {
        // Already on the publish page, just inject the script
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["loader.js"]
        });
    } else if (tab.url.includes("chaspark.com")) {
        // On Chaspark but not the publish page, redirect current tab
        chrome.tabs.update(tab.id, { url: PUBLISH_URL });
    } else {
        // Not on Chaspark, open in new tab
        chrome.tabs.create({ url: PUBLISH_URL });
    }
});

