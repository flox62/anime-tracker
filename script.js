const animeListContainer = document.getElementById('anime-list');
const genreButtonsContainer = document.getElementById('genre-buttons');
const generatePdfButton = document.getElementById('generate-pdf');

let animeQueue = [];
let currentPage = 1;
let seenTitles = new Set(JSON.parse(localStorage.getItem('seenAnime')) || []);
let shownTitles = new Set();
let selectedGenres = new Set(); // <- maintenant on a plusieurs genres

async function fetchGenres() {
  const response = await fetch('https://api.jikan.moe/v4/genres/anime');
  const data = await response.json();
  displayGenreButtons(data.data);
}

function displayGenreButtons(genres) {
  genres.forEach(genre => {
    const button = document.createElement('button');
    button.textContent = genre.name;
    button.dataset.genreId = genre.mal_id;

    button.addEventListener('click', () => {
      const genreId = parseInt(genre.mal_id);

      // toggle genre dans le Set
      if (selectedGenres.has(genreId)) {
        selectedGenres.delete(genreId);
        button.classList.remove('active');
      } else {
        selectedGenres.add(genreId);
        button.classList.add('active');
      }

      resetQueue();
      fetchMoreAnime();
    });

    genreButtonsContainer.appendChild(button);
  });
}

function resetQueue() {
  animeQueue = [];
  currentPage = 1;
  shownTitles = new Set();
}

async function fetchMoreAnime() {
  try {
    let url = `https://api.jikan.moe/v4/top/anime?page=${currentPage}`;
    if (selectedGenres.size > 0) {
      const genresParam = Array.from(selectedGenres).join(',');
      url = `https://api.jikan.moe/v4/anime?genres=${genresParam}&page=${currentPage}&order_by=popularity`;
    }

    const response = await fetch(url);
    const data = await response.json();
    currentPage++;

    const newAnime = data.data.filter(anime =>
      !seenTitles.has(anime.title) && !shownTitles.has(anime.title)
    );

    animeQueue.push(...newAnime);
    showNextAnime();
  } catch (error) {
    console.error('Erreur lors de la récupération des animes:', error);
  }
}

function showNextAnime() {
  animeListContainer.innerHTML = '';

  if (animeQueue.length === 0) {
    fetchMoreAnime();
    return;
  }

  const anime = animeQueue.shift();
  if (!anime) {
    animeListContainer.innerHTML = '<p>Plus d’animes à afficher pour l’instant...</p>';
    return;
  }

  shownTitles.add(anime.title);

  const animeCard = document.createElement('div');
  animeCard.classList.add('anime-card');

  const animeImage = document.createElement('img');
  animeImage.src = anime.images.jpg.image_url;
  animeImage.alt = anime.title;

  const animeTitle = document.createElement('h3');
  animeTitle.textContent = anime.title;

  const yesButton = document.createElement('button');
  yesButton.textContent = 'Oui';
  yesButton.addEventListener('click', () => {
    markAsSeen(anime.title);
    showNextAnime();
  });

  const noButton = document.createElement('button');
  noButton.textContent = 'Non';
  noButton.addEventListener('click', () => {
    showNextAnime();
  });

  animeCard.appendChild(animeImage);
  animeCard.appendChild(animeTitle);
  animeCard.appendChild(yesButton);
  animeCard.appendChild(noButton);

  animeListContainer.appendChild(animeCard);

  if (animeQueue.length < 5) {
    fetchMoreAnime();
  }
}

function markAsSeen(animeTitle) {
  seenTitles.add(animeTitle);
  let seenAnime = Array.from(seenTitles);
  localStorage.setItem('seenAnime', JSON.stringify(seenAnime));
}

generatePdfButton.addEventListener('click', () => {
  const seenAnime = Array.from(seenTitles);
  if (seenAnime.length === 0) {
    alert('Aucun anime marqué comme vu.');
    return;
  }

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Liste des animes vus', 10, 10);

  seenAnime.forEach((title, index) => {
    doc.text(`${index + 1}. ${title}`, 10, 20 + index * 10);
  });

  doc.save('animes_vus.pdf');
});

// Démarrage
fetchGenres();
fetchMoreAnime();
