const animeListContainer = document.getElementById('anime-list');
const generatePdfButton = document.getElementById('generate-pdf');

let animeQueue = [];
let currentIndex = 0;
let currentPage = 1;
let seenTitles = new Set(JSON.parse(localStorage.getItem('seenAnime')) || []);
let shownTitles = new Set();

async function fetchMoreAnime() {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/top/anime?page=${currentPage}`);
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

  // Précharger d'autres animes si la file devient courte
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

fetchMoreAnime();
