# Mini Ajintara

A hotel booking web app with three kinds of users: **guests** (search and book), **hotel partners** (list hotels, set prices and rooms per date) and **admins** (approve hotels, manage the platform).

> This README is built up feature by feature. Sections marked TODO are filled in as later phases are finished.

## Tech stack

- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Node.js, Express 5
- **Database:** MongoDB Atlas with Mongoose
- **Login:** JWT (see "Why JWT" below)
- **Other:** zod (input checks), bcrypt (password hashing), helmet, cors, express-rate-limit, dayjs (IST dates), vitest (tests)

## Run it locally

1. `cd server`, then `npm install`
2. Copy `.env.example` to `.env` and fill in the values (see below)
3. `npm run dev` starts the API on `http://localhost:5000`
4. In a second terminal: `cd client`, `npm install`, `npm run dev`
5. `npm test` in `server` runs all tests
6. Make an admin: sign up normally, then `npm run make-admin -- you@example.com`
7. Optional full check of a running server: `npm run smoke -- http://localhost:5000 <admin email> <admin password>`

## Environment variables

| Name | What it is |
|---|---|
| `PORT` | Port for the API (default 5000) |
| `MONGO_URI` | MongoDB Atlas connection link |
| `JWT_SECRET` | Long random text used to sign login tokens |
| `JWT_EXPIRES_IN` | How long a login lasts (default 7d) |
| `CLIENT_URL` | The frontend link. Only this site may call the API (CORS) |
| `LOGIN_RATE_LIMIT_MAX` | Login tries allowed per 15 minutes (default 10) |

## Why JWT (and not sessions)

JWT is stateless: the server does not store sessions, so it runs fine on a free host that sleeps and restarts, and the frontend (on a different domain) only has to send one header. The trade-off is that a token cannot be cancelled before it expires. We handle the important case, blocking a user, by loading the user from the database on every request, so a blocked user is stopped immediately even with an old token.

## Money

All money is stored and sent as **integers in paise** (Rs 1 = 100 paise, so Rs 4,500 = `450000`). This avoids decimal rounding bugs. The frontend turns paise into rupees only when showing them.

GST is worked out **per night** (5% when that night's room price is Rs 7,500 or less, otherwise 18%). The slabs live only in `server/src/config/taxSlabs.js`. The slab is picked using the price of **one room**, then multiplied by the number of rooms.

## Dates and time zone (IST)

- A stay date is stored as a plain text day like `"2026-12-24"` (a calendar day in India). It has no time and no time zone, so it can never shift.
- Real moments (check-in 2:00 PM IST, check-out 12:00 PM IST) are normal UTC dates. 2 PM IST is stored as 08:30 UTC.
- Every bit of date work goes through one file, `server/src/utils/ist.js`. Nothing else touches time zones. The tests run with the computer set to a US time zone to prove the result does not depend on the server.
- The frontend always shows dates with `Asia/Kolkata`.

## Database design

- **User**: name, email (unique), passwordHash, role (`guest` / `partner` / `admin`), isBlocked
- **Property**: partner (User), name, city, cityKey (clean lowercase city for searching), address, description, amenities, images, status (`pending` / `approved` / `rejected`), rejectionReason
- **RoomType**: property, name, basePrice, totalRooms, maxGuests
- **Inventory** (one row per room type per date): roomType, property, date, price, totalRooms, booked. A unique index on `(roomType, date)` stops duplicate rows. Free rooms = `totalRooms - booked`.
- **Booking**: TODO (Phase 3)

Relationships: a User (partner) owns many Properties, a Property has many RoomTypes, a RoomType has up to 365 Inventory rows.

Why an Inventory row per date: date-wise prices, closing a single date, and "free on every night" all become simple queries.

## How search works

`GET /api/properties/search`

1. Find approved hotels in the city (`cityKey` + `status` index).
2. Keep room types that fit the guests (`maxGuests`).
3. One database query over the Inventory rows for the stay's nights keeps only rows with a free room, groups them per room type, and keeps room types that were free on **every** night (nights counted = nights of the stay).
4. Average price per night is used for the price filter and sorting. A hotel is shown with its cheapest working room type.
5. Sorting, counting and paging all happen on the server (`page`, `limit`, max 50).

## Assumptions

- `maxGuests` is the limit for one room, and search checks one room fits all the guests.
- Search price filter and sort use the average price per night, before GST.
- Longest stay is 30 nights. Bookings go up to 365 days ahead (the days we create rows for). Both numbers are in `server/src/config/rules.js`.
- A partner cannot lower total rooms below the rooms already booked on a date.
- A partner who edits an approved hotel keeps it approved. A rejected hotel goes back to pending when the partner edits it.
- Admins cannot sign up by themselves. They are promoted with `npm run make-admin`.
- The Render free plan sleeps when unused, so the first request after a while can take about a minute.

## API list (so far)

All prices in paise. Protected routes need the header `Authorization: Bearer <token>`.

**Auth**
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`

**Public**
- `GET /api/properties/search?city=&checkIn=&checkOut=&guests=&minPrice=&maxPrice=&sort=price_asc|price_desc&page=&limit=`
- `GET /api/properties/:id?checkIn=&checkOut=&guests=` (dates optional)

**Partner** (partner role only)
- `POST /api/partner/properties`, `GET /api/partner/properties`, `GET /api/partner/properties/:id`, `PUT /api/partner/properties/:id`
- `POST /api/partner/properties/:id/room-types`
- `PUT /api/partner/room-types/:id/dates` (change price and/or rooms for a date range)
- `GET /api/partner/room-types/:id/calendar?from=&to=`

**Admin** (admin role only)
- `GET /api/admin/properties?status=pending`
- `PATCH /api/admin/properties/:id/approve`, `PATCH /api/admin/properties/:id/reject` (reason required)

More routes are added in the next phases.

## How double booking is prevented (A4)

TODO (Phase 3)

## Part B tasks done

TODO

## Known issues and limitations

TODO
