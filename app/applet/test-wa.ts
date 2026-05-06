import { fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
async function run() {
    try {
        console.log(await fetchLatestBaileysVersion());
    } catch(e) {
        console.error(e);
    }
}
run();
