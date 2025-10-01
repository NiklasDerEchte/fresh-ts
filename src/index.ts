import * as api from './api';

let options = {
    host: 'localhost',
    username: 'admin',
    password: 'admin',
    verify_ssl: true,
    verbose: false
};

function main() {
    console.log("Hello, TypeScript!");
    let freshRssApi = new api.FreshRSSAPI(options);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    freshRssApi.get_items_from_dates(startDate, endDate);
}

main();