import { check, group, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = 'https://restful-booker.herokuapp.com';
const JSON_HEADER = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

export const options = {
    // scenarios = several independent user types running at the same time
    scenarios: {
        // Scenario 1: users who only read data
        browsing: {
            executor: 'ramping-vus',        // same behavior as the "stages" you already use
            exec: 'browseBookings',         // name of the exported function this scenario runs
            startVUs: 0,                    // begin with 0 users
            stages: [
                { duration: '30s', target: 4 },  // ramp up to 4 users
                { duration: '1m', target: 4 },   // hold 4 users
                { duration: '15s', target: 0 },  // ramp down
            ],
        },

        // Scenario 2: a user who writes data
        managing: {
            executor: 'ramping-vus',
            exec: 'manageBooking',          // runs a different function than "browsing"
            startVUs: 0,
            stages: [
                { duration: '30s', target: 1 },  // ramp up to 1 user
                { duration: '1m', target: 1 },
                { duration: '15s', target: 0 },
            ],
        },
    },

    thresholds: {
        // Overall rules for the whole test
        http_req_failed: ['rate<0.05'],
        checks: ['rate>0.95'],

        // Rules per scenario: k6 automatically tags every request with its scenario name
        'http_req_duration{scenario:browsing}': ['p(95)<2000'],
        'http_req_duration{scenario:managing}': ['p(95)<2000'],
    },
};

// setup() runs once and its result is passed to EVERY scenario function as "data"
export function setup() {
    const auth = http.post(
        `${BASE_URL}/auth`,
        JSON.stringify({ username: 'admin', password: 'password123' }),
        { headers: JSON_HEADER }
    );

    check(auth, {
        'auth: status is 200': (r) => r.status === 200,
        'auth: token received': (r) => r.status === 200 && r.json('token') !== undefined,
    });

    return { token: auth.status === 200 ? auth.json('token') : undefined };
}

// ------------------------------------------------------------
// Scenario 1 function: read-only journey (runs by the 4 browsing VUs)
// ------------------------------------------------------------
export function browseBookings(data) {
    let firstId;

    group('Browse: get all bookings', () => {
        const res = http.get(`${BASE_URL}/booking`);

        check(res, {
            'browse list: status is 200': (r) => r.status === 200,
            'browse list: is a list': (r) => r.status === 200 && Array.isArray(r.json()),
        });

        // Save the first booking id from the list to look at it next
        if (res.status === 200 && res.json().length > 0) {
            firstId = res.json()[0].bookingid;
        }
    });

    sleep(2); // the user looks at the list

    // If the list was empty or failed, there is nothing to open
    if (!firstId) return;

    group('Browse: get one booking', () => {
        const res = http.get(`${BASE_URL}/booking/${firstId}`, { headers: JSON_HEADER });

        check(res, {
            'browse one: status is 200': (r) => r.status === 200,
        });
    });

    sleep(2); // the user reads the booking
}

// ------------------------------------------------------------
// Scenario 2 function: write journey (runs by the 1 managing VU)
// ------------------------------------------------------------
export function manageBooking(data) {
    let bookingId;

    group('Manage: create booking', () => {
        const res = http.post(
            `${BASE_URL}/booking`,
            JSON.stringify({
                firstname: `${__VU}user`,           // __VU = current virtual user number
                lastname: 'Billones',
                totalprice: Math.floor(Math.random() * 500) + 100, // random price 100-599
                depositpaid: true,
                bookingdates: { checkin: '2026-11-01', checkout: '2026-11-05' },
                additionalneeds: 'Dinner',
            }),
            { headers: JSON_HEADER }
        );

        check(res, {
            'create: status is 200': (r) => r.status === 200,
            'create: has booking id': (r) => r.status === 200 && r.json('bookingid') !== undefined,
        });

        bookingId = res.status === 200 ? res.json('bookingid') : undefined;
    });

    sleep(2);

    if (!bookingId) return; // nothing to update/delete if create failed

    group('Manage: update booking', () => {
        const res = http.put(
            `${BASE_URL}/booking/${bookingId}`,
            JSON.stringify({
                firstname: 'Updated',
                lastname: 'Billones',
                totalprice: 200,
                depositpaid: false,
                bookingdates: { checkin: '2026-11-01', checkout: '2026-11-06' },
                additionalneeds: 'Breakfast',
            }),
            { headers: { ...JSON_HEADER, Cookie: `token=${data.token}` } }
        );

        check(res, {
            'update: status is 200': (r) => r.status === 200,
        });
    });

    sleep(2);

    group('Manage: delete booking', () => {
        const res = http.del(`${BASE_URL}/booking/${bookingId}`, null, {
            headers: { ...JSON_HEADER, Cookie: `token=${data.token}` },
        });

        check(res, {
            'delete: status is 201': (r) => r.status === 201,
        });
    });

    sleep(2);
}