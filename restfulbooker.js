import { check, group, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'https://restful-booker.herokuapp.com';
const JSON_HEADER = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
}

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // ramp-up: go from 0 to 10 VUs in 30 seconds
        { duration: '1m', target: 15 },    // steady load: hold 15 VUs for 1 minute
        { duration: '30s', target: 0 },   // ramp-down: go back to 0 VUs
    ],

    // thresholds = pass/fail criteria for the whole test
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true }],
        checks: ['rate>0.95'],
        'http_req_duration{group:::Get all bookings}': ['p(95)<2000'],
        'http_req_duration{group:::Create Booking}': ['p(95)<2000'],
        'http_req_duration{group:::Get a booking}': ['p(95)<2000'],
        'http_req_duration{group:::Update a booking}': ['p(95)<2000'],
        'http_req_duration{group:::Delete booking}': ['p(95)<2000'],
    },
}


export function bookingInformation() {
    return {
        firstname: `${__VU}user`,
        lastname: 'Billones',
        totalprice: Math.floor(Math.random() * 500) + 100,
        depositpaid: true,
        bookingdates: {
            checkin: '2026-10-30',
            checkout: '2026-11-30'
        },
        additionalneeds: 'Dinner'
    }
}

export function setup() {
    const auth = http.post(`${BASE_URL}/auth`,
        JSON.stringify({ username: 'admin', password: 'password123' }),
        { headers: JSON_HEADER }
    )
    check(auth, {
        'status is 200': (r) => r.status === 200,
        'auth ok': (r) => r.json('token') !== undefined
    })

    return { token: auth.json('token') }
}


export default function (data) {
    let bookingId;

    group('Get all bookings', () => {
        const res = http.get(`${BASE_URL}/booking`)

        if (res.status !== 200) {
            console.log(`GET /booking failed: status=${res.status} body=${res.body}`);
        }

        check(res, {
            'get: status is 200': (r) => r.status === 200,
            'response is a list': (r) => r.status === 200 && Array.isArray(r.json()),
        })
    })

    sleep(2)

    group('Create Booking', () => {
        const res = http.post(`${BASE_URL}/booking`,
            JSON.stringify(bookingInformation()),
            {
                headers:
                    JSON_HEADER
            }
        )

        if (res.status !== 200) {
            console.log(`POST /booking failed: status=${res.status} body=${res.body}`);
        }

        check(res, {
            'create: status is 200': (r) => r.status === 200,
            'booking has booking ID': (r) => r.json('bookingid') !== undefined

        })

        bookingId = res.status === 200 ? res.json('bookingid') : undefined;
        if (!bookingId) return;
    })

    sleep(2)

    group('Get a booking', () => {
        const res = http.get(`${BASE_URL}/booking/${bookingId}`,
            {
                headers: JSON_HEADER
            }
        )

        if (res.status !== 200) {
            console.log(`GET /booking failed: status=${res.status} body=${res.body}`);
        }

        check(res, {
            'get: status is 200': (r) => r.status === 200,
            'lastname is matched': (r) => r.json('lastname') === 'Billones'
        })
    })

    sleep(2)

    group('Update a booking', () => {
        const res = http.put(`${BASE_URL}/booking/${bookingId}`,
            JSON.stringify({
                firstname: `Updated`,
                lastname: 'Billones',
                totalprice: 200,
                depositpaid: false,
                bookingdates: {
                    checkin: '2026-11-01',
                    checkout: '2026-12-30'
                },
                additionalneeds: 'Breakfast'
            }), {
            headers: { ...JSON_HEADER, Cookie: `token=${data.token}` }
        }
        )

        if (res.status !== 200) {
            console.log(`PUT /booking failed: status=${res.status} body=${res.body}`);
        }

        check(res, {
            'update: status is 200': (r) => r.status === 200,
            'firstname is updated': (r) => r.json('firstname') === 'Updated'
        })
    })

    sleep(2)

    group('Delete booking', () => {
        const res = http.del(`${BASE_URL}/booking/${bookingId}`, null,
            {
                headers: { ...JSON_HEADER, Cookie: `token=${data.token}` }
            }
        )
        check(res, {
            'delete: status is 201': (r) => r.status === 201,
        })
    })

    sleep(2)
}

export function teardown() {
    console.log('Performance is finished')
}