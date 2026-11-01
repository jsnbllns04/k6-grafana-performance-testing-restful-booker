# Restful-Booker Performance Testing with k6

Load tests for the public [Restful-Booker](https://restful-booker.herokuapp.com) API, written with **Grafana k6**. This is a practice project that applies performance testing concepts: realistic user flows, load stages, pass/fail thresholds and reporting.

## Test Scripts
| Script | What it does |
|---|---|
| `restfulbooker.js` | Full booking lifecycle: get all bookings, create, get one, update, delete. Authentication token is obtained once in `setup()`. |
| `booker-with-trafficsplits.js` | Two user types running at the same time: **browsing** users (read-only, up to 4 VUs) and a **managing** user (create, update, delete, 1 VU). |

## Load Profile
**`restfulbooker.js`** (about 2 minutes)
- 30 s: ramp up to 10 virtual users
- 1 min: ramp up to 15 virtual users
- 30 s: ramp down to 0

**`booker-with-trafficsplits.js`** (about 1 minute 45 seconds)
- Browsing scenario: ramp to 4 VUs, hold, ramp down
- Managing scenario: ramp to 1 VU, hold, ramp down

Each step is followed by a 2 second pause to simulate a real user.

## Thresholds (pass/fail criteria)
- 95th percentile response time under 2000 ms, overall and per endpoint
- Failed requests under 5% (the test aborts if this is exceeded in `restfulbooker.js`)
- More than 95% of checks pass

Each request has checks on status codes and response content (for example, a returned booking ID, or an updated first name).

## Results
Last run of `restfulbooker.js`:

| Metric | Result |
|---|---|
| Peak virtual users | [15] |
| Total requests | [911] |
| Average response time | [354.85] ms |
| 95th percentile response time | [771.8] ms |
| Failed requests | [0] % |
| Checks passed | [100] % |
| Thresholds | [Passed] |

**Observations:** [Which endpoint was slowest? Did response times grow as users increased? Did any check fail?]

Note: Restful-Booker is a shared public demo server, so response times can vary between runs and the data can be reset at any time. These results are for learning and are not a benchmark.

## Getting Started
**Requirements:** [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed (for example `winget install k6` on Windows)

```bash
git clone https://github.com/jsnbllns04/k6-grafana-performance-testing-restful-booker.git
cd k6-grafana-performance-testing-restful-booker
```

## Running the Tests
```bash
k6 run restfulbooker.js
k6 run booker-with-trafficsplits.js
k6 run -e BASE_URL=https://restful-booker.herokuapp.com restfulbooker.js   # override the base URL
```

To also produce an HTML report (PowerShell):
```powershell
$env:K6_WEB_DASHBOARD="true"
$env:K6_WEB_DASHBOARD_EXPORT="report.html"
k6 run restfulbooker.js
```
The report from my last run is in [`report.html`](report.html). Download it and open it in a browser.

## Author
Jason Aubrey P. Billones, jsnbllns04@gmail.com