require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/books', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Please enter a search term.' });
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&key=${process.env.GOOGLE_BOOKS_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ error: 'The book service is not responding right now. Please try again later.' });
    }

    const data = await response.json();
    const items = data.items || [];

    const books = items.map((item) => {
      const info = item.volumeInfo || {};
      return {
        id: item.id,
        title: info.title || 'Untitled',
        authors: info.authors || ['Unknown author'],
        publishedDate: info.publishedDate || '',
        pageCount: info.pageCount || 0,
        category: (info.categories && info.categories[0]) || 'Uncategorised',
        thumbnail: info.imageLinks ? info.imageLinks.thumbnail.replace('http://', 'https://') : '',
        link: info.previewLink || '',
        preview: item.accessInfo ? item.accessInfo.viewability !== 'NO_PAGES' : false
      };
    });

    res.json({ total: books.length, books });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Could not reach the book service. Check your internet connection.' });
  }
});

app.listen(PORT, () => {
  console.log(`Book Finder running on http://localhost:${PORT}`);
});
