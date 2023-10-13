messenger.browserAction.onClicked.addListener(async (_tab, _info) => {
    messenger.tabs.create({
        url: "https://feedly.com"
    });
});