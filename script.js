// Import Hammer.js (if not already included in your HTML)
// import Hammer from 'hammerjs'; // Uncomment if using a module bundler

// DOM Elements
const animeCardContainer = document.getElementById("anime-card-container")
const genreButtonsContainer = document.getElementById("genre-buttons")
const generatePdfButton = document.getElementById("generate-pdf")
const filterButton = document.getElementById("filter-button")
const filterPanel = document.getElementById("filter-panel")
const closeFilterButton = document.getElementById("close-filter")
const likeButton = document.getElementById("like-button")
const dislikeButton = document.getElementById("dislike-button")
const clearAllButton = document.getElementById("clear-all")
const genreSearch = document.getElementById("genre-search")
const clearSearch = document.getElementById("clear-search")
const clearGenres = document.getElementById("clear-genres")
const resetFilters = document.getElementById("reset-filters")
const applyFilters = document.getElementById("apply-filters")
const filterBadge = document.getElementById("filter-badge")
const yearFilter = document.getElementById("year-filter")
const quickFilterButtons = document.querySelectorAll(".quick-filter-btn")
const typeFilterButtons = document.querySelectorAll(".type-filter-btn")

// State variables
let animeQueue = []
let currentPage = 1
const seenTitles = new Set(JSON.parse(localStorage.getItem("seenAnime")) || [])
let shownTitles = new Set()
const selectedGenres = new Set()
let selectedType = ""
let selectedYear = ""
let selectedQuickFilter = ""
let currentCard = null
let isAnimating = false
let allGenres = []
let isFilterChanged = false

// Initialize the app
async function initApp() {
  await fetchGenres()
  await fetchMoreAnime()
  setupEventListeners()
}

// Fetch genres from API
async function fetchGenres() {
  try {
    const response = await fetch("https://api.jikan.moe/v4/genres/anime")
    const data = await response.json()
    allGenres = data.data
    displayGenreButtons(allGenres)
  } catch (error) {
    console.error("Error fetching genres:", error)
  }
}

// Display genre filter buttons
function displayGenreButtons(genres) {
  genreButtonsContainer.innerHTML = ""

  // Sort genres alphabetically
  genres.sort((a, b) => a.name.localeCompare(b.name))

  genres.forEach((genre) => {
    const button = document.createElement("button")
    button.textContent = genre.name
    button.dataset.genreId = genre.mal_id

    // Check if this genre is already selected
    if (selectedGenres.has(Number.parseInt(genre.mal_id))) {
      button.classList.add("active")
    }

    button.addEventListener("click", () => {
      const genreId = Number.parseInt(genre.mal_id)

      // Toggle genre in the Set
      if (selectedGenres.has(genreId)) {
        selectedGenres.delete(genreId)
        button.classList.remove("active")
      } else {
        selectedGenres.add(genreId)
        button.classList.add("active")
      }

      updateFilterBadge()
      isFilterChanged = true
    })

    genreButtonsContainer.appendChild(button)
  })
}

// Update the filter badge with the count of selected filters
function updateFilterBadge() {
  let filterCount = selectedGenres.size
  if (selectedType) filterCount++
  if (selectedYear) filterCount++
  if (selectedQuickFilter) filterCount++

  if (filterCount > 0) {
    filterBadge.textContent = filterCount
    filterBadge.classList.remove("hidden")
  } else {
    filterBadge.classList.add("hidden")
  }
}

// Filter genres based on search input
function filterGenres(searchTerm) {
  if (!searchTerm) {
    displayGenreButtons(allGenres)
    return
  }

  const filteredGenres = allGenres.filter((genre) => genre.name.toLowerCase().includes(searchTerm.toLowerCase()))

  displayGenreButtons(filteredGenres)
}

// Reset anime queue
function resetQueue() {
  animeQueue = []
  currentPage = 1
  shownTitles = new Set()

  // Remove current card if exists
  if (currentCard) {
    animeCardContainer.removeChild(currentCard)
    currentCard = null
  }

  animeCardContainer.innerHTML = '<div id="loading">Loading...</div>'
}

// Build the API URL based on selected filters
function buildApiUrl() {
  let url

  // Handle quick filters
  if (selectedQuickFilter === "popular") {
    url = `https://api.jikan.moe/v4/top/anime?page=${currentPage}`
  } else if (selectedQuickFilter === "top-rated") {
    url = `https://api.jikan.moe/v4/top/anime?page=${currentPage}&filter=bypopularity`
  } else if (selectedQuickFilter === "new") {
    url = `https://api.jikan.moe/v4/seasons/now?page=${currentPage}`
  } else {
    // Default search with filters
    url = `https://api.jikan.moe/v4/anime?page=${currentPage}&order_by=popularity`

    // Add genre filter
    if (selectedGenres.size > 0) {
      const genresParam = Array.from(selectedGenres).join(",")
      url += `&genres=${genresParam}`
    }

    // Add type filter
    if (selectedType) {
      url += `&type=${selectedType}`
    }

    // Add year filter
    if (selectedYear) {
      if (selectedYear.endsWith("s")) {
        // Handle decade filters (e.g., "2010s")
        const decade = selectedYear.substring(0, 4)
        url += `&start_date=${decade}-01-01&end_date=${Number(decade) + 9}-12-31`
      } else if (selectedYear === "classic") {
        // Handle "classic" filter (before 1990)
        url += `&end_date=1989-12-31`
      } else {
        // Handle specific year
        url += `&start_date=${selectedYear}-01-01&end_date=${selectedYear}-12-31`
      }
    }
  }

  return url
}

// Fetch more anime from API
async function fetchMoreAnime() {
  try {
    // Add delay to avoid API rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const url = buildApiUrl()
    const response = await fetch(url)
    const data = await response.json()
    currentPage++

    // Handle different API response formats
    const animeList = data.data || []

    const newAnime = animeList.filter((anime) => !seenTitles.has(anime.title) && !shownTitles.has(anime.title))

    animeQueue.push(...newAnime)

    // If this is the first fetch, show the first anime
    if (animeCardContainer.innerHTML.includes("Loading")) {
      showNextAnime()
    }
  } catch (error) {
    console.error("Error fetching anime:", error)
    animeCardContainer.innerHTML = '<div id="loading">Error loading anime. Try again later.</div>'
  }
}

// Show the next anime card
function showNextAnime() {
  // If we're animating, don't show next anime yet
  if (isAnimating) return

  // Remove current card if exists
  if (currentCard) {
    animeCardContainer.removeChild(currentCard)
    currentCard = null
  }

  if (animeQueue.length === 0) {
    animeCardContainer.innerHTML = '<div id="loading">Loading more anime...</div>'
    fetchMoreAnime()
    return
  }

  const anime = animeQueue.shift()
  if (!anime) {
    animeCardContainer.innerHTML = '<div id="loading">No more anime to display right now...</div>'
    return
  }

  shownTitles.add(anime.title)

  // Create new anime card
  const animeCard = document.createElement("div")
  animeCard.classList.add("anime-card")

  // Create like/dislike indicators
  const likeIndicator = document.createElement("div")
  likeIndicator.classList.add("swipe-indicator", "like", "hidden")
  likeIndicator.textContent = "LIKE"

  const dislikeIndicator = document.createElement("div")
  dislikeIndicator.classList.add("swipe-indicator", "dislike", "hidden")
  dislikeIndicator.textContent = "NOPE"

  // Create anime image
  const animeImage = document.createElement("img")
  animeImage.src = anime.images.jpg.large_image_url || anime.images.jpg.image_url
  animeImage.alt = anime.title

  // Create anime info section
  const animeInfo = document.createElement("div")
  animeInfo.classList.add("anime-info")

  const animeTitle = document.createElement("h3")
  animeTitle.textContent = anime.title

  const animeDetails = document.createElement("p")
  const year = anime.aired && anime.aired.from ? new Date(anime.aired.from).getFullYear() : "?"
  animeDetails.textContent = `${anime.type || "TV"} · ${year} · ${anime.episodes || "?"} eps · ${anime.score || "?"}/10`

  // Assemble the card
  animeInfo.appendChild(animeTitle)
  animeInfo.appendChild(animeDetails)
  animeCard.appendChild(likeIndicator)
  animeCard.appendChild(dislikeIndicator)
  animeCard.appendChild(animeImage)
  animeCard.appendChild(animeInfo)

  // Add the card to the container
  animeCardContainer.innerHTML = ""
  animeCardContainer.appendChild(animeCard)
  currentCard = animeCard

  // Set up Hammer.js for swipe gestures
  setupSwipeGestures(animeCard, anime.title)

  // Fetch more anime if queue is getting low
  if (animeQueue.length < 3) {
    fetchMoreAnime()
  }
}

// Set up swipe gestures with Hammer.js
function setupSwipeGestures(element, animeTitle) {
  // Declare Hammer if it's not already declared globally
  let hammer
  if (typeof Hammer !== "undefined") {
    hammer = new Hammer(element)
  } else {
    console.error("Hammer.js is not loaded.")
    return
  }
  hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL })

  let xPos = 0
  let yPos = 0
  let rotation = 0

  hammer.on("pan", (e) => {
    if (isAnimating) return

    element.style.transition = "none"
    xPos = e.deltaX
    yPos = e.deltaY
    rotation = xPos * 0.05

    element.style.transform = `translate(${xPos}px, ${yPos}px) rotate(${rotation}deg)`

    // Show like/dislike indicators based on swipe direction
    const likeIndicator = element.querySelector(".swipe-indicator.like")
    const dislikeIndicator = element.querySelector(".swipe-indicator.dislike")

    if (xPos > 50) {
      likeIndicator.classList.remove("hidden")
      dislikeIndicator.classList.add("hidden")
    } else if (xPos < -50) {
      dislikeIndicator.classList.remove("hidden")
      likeIndicator.classList.add("hidden")
    } else {
      likeIndicator.classList.add("hidden")
      dislikeIndicator.classList.add("hidden")
    }
  })

  hammer.on("panend", (e) => {
    element.style.transition = "transform 0.5s ease"

    if (xPos > 100) {
      // Swiped right (like)
      element.style.transform = `translate(${window.innerWidth}px, ${yPos}px) rotate(${rotation}deg)`
      markAsSeen(animeTitle)
      handleSwipeAnimation("right")
    } else if (xPos < -100) {
      // Swiped left (dislike)
      element.style.transform = `translate(-${window.innerWidth}px, ${yPos}px) rotate(${rotation}deg)`
      handleSwipeAnimation("left")
    } else {
      // Return to center if not swiped far enough
      element.style.transform = "translate(0, 0) rotate(0deg)"
      const indicators = element.querySelectorAll(".swipe-indicator")
      indicators.forEach((indicator) => indicator.classList.add("hidden"))
    }
  })
}

// Handle swipe animation and show next card
function handleSwipeAnimation(direction) {
  isAnimating = true

  // Wait for animation to complete before showing next card
  setTimeout(() => {
    isAnimating = false
    showNextAnime()
  }, 300)
}

// Mark anime as seen and save to localStorage
function markAsSeen(animeTitle) {
  seenTitles.add(animeTitle)
  const seenAnime = Array.from(seenTitles)
  localStorage.setItem("seenAnime", JSON.stringify(seenAnime))
}

// Clear all seen anime from localStorage
function clearAllAnime() {
  if (confirm("Are you sure you want to clear your entire anime list? This cannot be undone.")) {
    seenTitles.clear()
    localStorage.removeItem("seenAnime")
    alert("Your anime list has been cleared!")
  }
}

// Generate PDF of seen anime
function generatePDF() {
  const seenAnime = Array.from(seenTitles)
  if (seenAnime.length === 0) {
    alert("No anime marked as seen yet.")
    return
  }

  // Declare jsPDF if it's not already declared globally
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  doc.setFontSize(20)
  doc.text("My Anime List", 20, 20)

  doc.setFontSize(12)
  seenAnime.forEach((title, index) => {
    if (index > 0 && index % 40 === 0) {
      doc.addPage()
    }
    const yPos = 30 + (index % 40) * 7
    doc.text(`${index + 1}. ${title}`, 20, yPos)
  })

  doc.save("my_anime_list.pdf")
}

// Apply filters and fetch new anime
function applyFiltersAndFetch() {
  if (isFilterChanged) {
    resetQueue()
    fetchMoreAnime()
    isFilterChanged = false
  }

  filterPanel.classList.add("hidden")
}

// Reset all filters
function resetAllFilters() {
  selectedGenres.clear()
  selectedType = ""
  selectedYear = ""
  selectedQuickFilter = ""

  // Reset UI
  const activeButtons = document.querySelectorAll(".active")
  activeButtons.forEach((button) => button.classList.remove("active"))

  yearFilter.value = ""

  updateFilterBadge()
  isFilterChanged = true
}

// Set up event listeners
function setupEventListeners() {
  // Filter button
  filterButton.addEventListener("click", () => {
    filterPanel.classList.toggle("hidden")
  })

  // Close filter panel
  closeFilterButton.addEventListener("click", () => {
    filterPanel.classList.add("hidden")

    if (isFilterChanged) {
      if (confirm("You have unsaved filter changes. Apply them?")) {
        applyFiltersAndFetch()
      }
    }
  })

  // Apply filters
  applyFilters.addEventListener("click", applyFiltersAndFetch)

  // Reset filters
  resetFilters.addEventListener("click", resetAllFilters)

  // Clear genres
  clearGenres.addEventListener("click", () => {
    selectedGenres.clear()
    const activeGenreButtons = genreButtonsContainer.querySelectorAll(".active")
    activeGenreButtons.forEach((button) => button.classList.remove("active"))
    updateFilterBadge()
    isFilterChanged = true
  })

  // Genre search
  genreSearch.addEventListener("input", (e) => {
    const searchTerm = e.target.value
    filterGenres(searchTerm)

    if (searchTerm) {
      clearSearch.classList.remove("hidden")
    } else {
      clearSearch.classList.add("hidden")
    }
  })

  // Clear search
  clearSearch.addEventListener("click", () => {
    genreSearch.value = ""
    filterGenres("")
    clearSearch.classList.add("hidden")
  })

  // Year filter
  yearFilter.addEventListener("change", (e) => {
    selectedYear = e.target.value
    updateFilterBadge()
    isFilterChanged = true
  })

  // Quick filter buttons
  quickFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filterType = button.dataset.filter

      // Toggle active state
      if (selectedQuickFilter === filterType) {
        selectedQuickFilter = ""
        button.classList.remove("active")
      } else {
        // Remove active class from all quick filter buttons
        quickFilterButtons.forEach((btn) => btn.classList.remove("active"))

        selectedQuickFilter = filterType
        button.classList.add("active")
      }

      updateFilterBadge()
      isFilterChanged = true
    })
  })

  // Type filter buttons
  typeFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type

      // Toggle active state
      if (selectedType === type) {
        selectedType = ""
        button.classList.remove("active")
      } else {
        // Remove active class from all type filter buttons
        typeFilterButtons.forEach((btn) => btn.classList.remove("active"))

        selectedType = type
        button.classList.add("active")
      }

      updateFilterBadge()
      isFilterChanged = true
    })
  })

  // Generate PDF button
  generatePdfButton.addEventListener("click", generatePDF)

  // Clear all button
  clearAllButton.addEventListener("click", clearAllAnime)

  // Like button
  likeButton.addEventListener("click", () => {
    if (currentCard && !isAnimating) {
      currentCard.style.transition = "transform 0.5s ease"
      currentCard.classList.add("swiping-right")

      const animeTitle = currentCard.querySelector("h3").textContent
      markAsSeen(animeTitle)
      handleSwipeAnimation("right")
    }
  })

  // Dislike button
  dislikeButton.addEventListener("click", () => {
    if (currentCard && !isAnimating) {
      currentCard.style.transition = "transform 0.5s ease"
      currentCard.classList.add("swiping-left")
      handleSwipeAnimation("left")
    }
  })
}

// Start the app
initApp()
