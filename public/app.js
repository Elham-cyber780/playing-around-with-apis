const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const controls = document.getElementById('controls');
const sortSelect = document.getElementById('sort-select');
const categorySelect = document.getElementById('category-select');
const previewOnly = document.getElementById('preview-only');
const message = document.getElementById('message');
const results = document.getElementById('results');

let allBooks = [];

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = input.value.trim();

  if (!query) {
    showMessage('Please enter a search term.', true);
    return;
  }

  showMessage('Searching...');
  results.innerHTML = '';
  controls.hidden = true;

  try {
    const response = await fetch(`/api/books?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Something went wrong. Please try again.', true);
      return;
    }

    if (data.books.length === 0) {
      showMessage(`No books found for "${query}". Try a different search.`);
      return;
    }

    allBooks = data.books;
    fillCategories();
    sortSelect.value = 'relevance';
    previewOnly.checked = false;
    controls.hidden = false;
    render();
  } catch (error) {
    showMessage('Could not connect to the server. Please check your connection and try again.', true);
  }
});

sortSelect.addEventListener('change', render);
categorySelect.addEventListener('change', render);
previewOnly.addEventListener('change', render);

function fillCategories() {
  const categories = [...new Set(allBooks.map((book) => book.category))].sort();
  categorySelect.innerHTML = '<option value="all">All categories</option>';

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

function render() {
  let books = [...allBooks];

  if (categorySelect.value !== 'all') {
    books = books.filter((book) => book.category === categorySelect.value);
  }

  if (previewOnly.checked) {
    books = books.filter((book) => book.preview);
  }
  results.innerHTML = '';

  if (books.length === 0) {
    showMessage('No books match these filters. Try changing them.');
    return;

  }


  showMessage(`Showing ${books.length} of ${allBooks.length} books`);
  books.forEach((book) => results.appendChild(createCard(book)));

}

function createCard(book) {

  const card = document.createElement('article');
  card.className = 'card';


  if (book.thumbnail) {

    const img = document.createElement('img');
    img.src = book.thumbnail;
    img.alt = `Cover of ${book.title}`;
    card.appendChild(img);

  } else {
    const noCover = document.createElement('div');
    noCover.className = 'no-cover';
    noCover.textContent = 'No cover';

    card.appendChild(noCover);
  }


  const title = document.createElement('h2');
  title.textContent = book.title;


  const authors = document.createElement('p');
  authors.className = 'authors';
  authors.textContent = book.authors.join(', ');


  const details = document.createElement('p');

  details.className = 'details';

  const year = book.publishedDate ? book.publishedDate.slice(0, 4) : 'Unknown year';

  const pages = book.pageCount ? `${book.pageCount} pages` : 'Pages unknown';
  details.textContent = `${year} · ${pages} · ${book.category}`;


  card.append(title, authors, details);


  if (book.preview) {

    const badge = document.createElement('span');

    badge.className = 'badge';

    badge.textContent = 'Preview available';
    card.appendChild(badge);

  }

  if (book.link) {
    const link = document.createElement('a');
    link.href = book.link;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'View on Google Books';
    card.appendChild(link);
  }

  return card;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = isError ? 'error' : '';

}
