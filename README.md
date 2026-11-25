
# Book Finder

A web application that helps students find study books quickly. Users search Google Books by title, author or topic, then **sort**, **filter** and browse the results in a clean card layout.

**Live app (via load balancer):** https://www.elhamcodes.tech
**Demo video:** https://youtu.be/YmiUOOSm74k



## Why I built this
I built this because I wanted students to have access to all books online within seconds to save time and energy. This will also help them to cultivate the habit of reading.


## Features

- **Search** books by title, author or topic (Google Books API)
- **Sort** results by relevance, newest, oldest, title (A–Z) or most pages
- **Filter** results by category, or show only books with a preview available
- Live result count ("Showing 7 of 20 books") so users can see filters working
- Book cards with cover, title, authors, year, page count, category and a link to Google Books
- **Error handling** with clear messages for:
  - empty searches
  - searches with no results
  - the Google Books API being down or rejecting the request
  - the server being unreachable
- **API key kept secret** on the server: the browser never sees it
- **XSS protection**: book data is inserted with `textContent`, never `innerHTML`
- Responsive layout that works on phones and laptops

---

## Tech stack

| Part | Tool |
|---|---|
| Backend | Node.js 22, Express |
| Frontend | HTML, CSS, vanilla JavaScript |
| Secrets | dotenv (`.env` file, excluded from Git) |
| Process manager | PM2 |
| Web server / reverse proxy | Nginx (on Web01 and Web02) |
| Load balancer | HAProxy with SSL termination (on Lb01) |

### How a request flows

```
Browser → https://www.elhamcodes.tech
        → Lb01 (HAProxy: HTTPS, round-robin)
        → Web01 or Web02 (Nginx on port 80 → Node app on port 3000)
        → Google Books API


The browser only ever talks to **my** server (`/api/books`). The server adds the API key and calls Google, so the key is never exposed in the frontend.

---

## Project structure


playing-around-with-apis/
├── public/
│   ├── index.html   # page structure
│   ├── style.css    # styling and responsive grid
│   └── app.js       # search, sort, filter and rendering logic
├── server.js        # Express server and /api/books route
├── package.json
├── .gitignore       # excludes node_modules/ and .env
└── README.md



## Running locally

**Requirements:** Node.js 18 or newer, and a Google Books API key.

1. Clone the repository:
   bash
   git clone https://github.com/Elham-cyber780/playing-around-with-apis.git
   cd playing-around-with-apis
   
2. Install dependencies:
   bash
   npm install
   
3. Create a `.env` file in the project root:
   
   GOOGLE_BOOKS_API_KEY=your_api_key_here
   PORT=3000
   
4. Start the app:
   bash
   npm start
   
5. Open http://localhost:3000

### Getting a Google Books API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Go to **APIs & Services → Library**, search **Books API**, and click **Enable**.
3. Go to **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key to the **Books API** only.



## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Returns `{"status":"ok","server":"<hostname>"}`. Used to check a server is alive and to see which server answered. |
| `GET /api/books?q=<search>` | Returns up to 20 books as `{ total, books: [...] }`. Returns `400` for an empty search, `502` if Google Books fails, `500` if the server can't reach Google. |



## Deployment

The app runs on two web servers behind a load balancer.

| Server | IP | Role |
|---|---|---|
| 7388-web-01 | 13.40.54.207 | Runs the app (Nginx + Node) |
| 7388-web-02 | 18.171.61.242 | Runs the app (identical copy) |
| 7388-lb-01 | 18.133.78.182 | HAProxy load balancer with HTTPS |

### 1. Web servers (repeated on Web01 and Web02)

**Install Node.js 22, Git and nano** (Ubuntu 20.04's own Node is too old for `fetch`):
bash
sudo apt update
sudo apt install -y git curl nano
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs


**Get the code and add the API key** (the `.env` file is not in GitHub, so it is created by hand on each server):
bash
cd ~
git clone https://github.com/Elham-cyber780/playing-around-with-apis.git
cd playing-around-with-apis
nano .env        # add GOOGLE_BOOKS_API_KEY and PORT=3000
npm install


**Run the app with PM2** so it keeps running in the background and restarts after a reboot:
bash
sudo npm install -g pm2
pm2 start server.js --name book-finder
pm2 startup      # then run the sudo command it prints
pm2 save


**Configure Nginx as a reverse proxy** (`/etc/nginx/sites-available/default`), forwarding port 80 to the Node app on port 3000:
nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    add_header X-Served-By $hostname always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header X-Served-By;
    }
}

- add_header X-Served-By $hostname` stamps each response with the server's name, so I can see which server answered.
- proxy_hide_header X-Served-By` removes the copy added by the Node app, so the header appears only once.

bash
sudo nginx -t                  # test the config
sudo systemctl reload nginx    # apply it


### 2. Load balancer (Lb01)

HAProxy config (`/etc/haproxy/haproxy.cfg`):

frontend www-http
    bind *:80
    http-request add-header X-Forwarded-Proto http
    redirect scheme https code 301 if !{ ssl_fc }
    default_backend www-backend

frontend www-https
    bind *:443 ssl crt /etc/haproxy/certs/www.elhamcodes.tech.pem
    http-request add-header X-Forwarded-Proto https
    default_backend www-backend

backend www-backend
    balance roundrobin
    server 7388-web-01 13.40.54.207:80 check
    server 7388-web-02 18.171.61.242:80 check
```
- **Port 80** redirects all HTTP visitors to HTTPS.
- **Port 443** handles HTTPS using the SSL certificate for `www.elhamcodes.tech` (SSL termination happens here, so the web servers don't need certificates).
- **`balance roundrobin`** sends each request to the next server in turn.
- **`check`** makes HAProxy health-check each server and stop sending traffic to one that is down.

### 3. Testing the load balancer

bash
for i in 1 2 3 4; do curl -sI https://www.elhamcodes.tech | grep -i x-served-by; done

Output:

x-served-by: 7388-web-02
x-served-by: 7388-web-01
x-served-by: 7388-web-02
x-served-by: 7388-web-01

The responses alternate between the two servers, confirming that traffic is balanced.

### Updating the app after a code change

On each web server:
bash
cd ~/playing-around-with-apis
git pull
npm install
pm2 restart book-finder




## Challenges and how I solved them

## Challenges and Lessons Learned

- **API key not valid:** Initially, I pasted the example API key into my `.env` file instead of replacing it with my actual Google API key. Google rejected it, and I learned that `.env` files store private configuration values, which must contain the correct credentials rather than example placeholders.

- **Google Cloud and school account:** I couldn't create a Google Cloud project using my ALU account because it required an organisation. I switched to my personal Gmail, but first had to enable 2-step verification. This taught me that some cloud services have account and security requirements that must be met before using them.

- **SSH Permission denied (publickey):** I experienced SSH authentication issues because the RSA key registered on the intranet did not match my laptop's current key. After trying a new ed25519 key and eventually generating an RSA key, I managed to connect through my WSL terminal using the original key. I learned that SSH relies on matching public and private keys for authentication, and that the private key must remain secure.

- **Commands on the wrong machine:** After my SSH connection dropped, I unknowingly continued running Nginx configuration commands on my local laptop instead of the Web01 server. I noticed the mistake by checking the terminal prompt and restored my laptop's configuration using a backup. This taught me to always verify which machine I am connected to before executing commands, especially when changing system configurations.

- **API key not valid:** my first test returned "API key not valid" because ...
- **Creating the Google Cloud project with a school account:** ...
- **SSH "Permission denied (publickey)":** ...
- **Running server commands on my laptop by mistake:** ...
- **Node.js missing / too old on the servers:** ...
- **Duplicate `X-Served-By` header:** ...



## Credits

- **[Google Books API](https://developers.google.com/books/docs/v1/using)** by Google: all book data (titles, authors, covers, categories, previews).
- **[Express](https://expressjs.com/)**: web framework for the backend.
- **[dotenv](https://github.com/motdotla/dotenv)**: loads the API key from `.env`.
- **[PM2](https://pm2.keymetrics.io/)**: keeps the app running on the servers.
- **[Nginx](https://nginx.org/)**: reverse proxy on the web servers.
- **[HAProxy](https://www.haproxy.org/)**: load balancer.
- **[NodeSource](https://github.com/nodesource/distributions)**: Node.js packages for Ubuntu.



## Author

Abdul Rahman Elham Wumpini, BSc Software Engineering, African Leadership University