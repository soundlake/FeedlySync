const btn_open = document.getElementById('btn_open');
const btn_submit = document.getElementById('btn_submit');
const input = document.getElementById('sso_url');

btn_open.addEventListener('click', _e => {
    messenger.tabs.create({ url: 'https://feedly.com/i/my' });
})

btn_submit.addEventListener('click', _e => {
    const sso_url = input.value;
    messenger.tabs.create({ url: sso_url });
});