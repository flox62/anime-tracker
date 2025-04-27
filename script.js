// DOM Elements
const animeCardContainer = document.getElementById("anime-card-container")
const genreButtonsContainer = document.getElementById("genre-buttons")
const generatePdfButton = document.getElementById("generate-pdf")
const filterButton = document.getElementById("filter-button")
const filterPanel = document.getElementById("filter-panel")
const closeFilterButton = document.getElementById("close-filter")
const likeButton = document.getElementById("like-button")
const dislikeButton = document.getElementById("dislike-button")
const undoButton = document.getElementById("undo-button")
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
const likedCountElement = document.getElementById("liked-count")
const episodesCountElement = document.getElementById("episodes-count")
const totalCountElement = document.getElementById("total-count")
// Add these DOM elements at the top with the other DOM elements
const animeHistoryList = document.getElementById("anime-history-list")
const desktopLikedCount = document.getElementById("desktop-liked-count")
const desktopEpisodesCount = document.getElementById("desktop-episodes-count")

// State variables
let animeQueue = []
let currentPage = 1
const seenTitles = new Set(JSON.parse(localStorage.getItem("seenAnime")) || [])
let shownTitles = new Set()
const selectedGenres = new Set()
const bannedGenres = new Set()
let selectedType = ""
let selectedYear = ""
let selectedQuickFilter = ""
let currentCard = null
let isAnimating = false
let allGenres = []
let isFilterChanged = false
let isDesktop = window.innerWidth >= 1024
let isImageInteraction = false

// Stats
let likedCount = Number.parseInt(localStorage.getItem("likedCount") || "0")
let episodesCount = Number.parseInt(localStorage.getItem("episodesCount") || "0")
let skippedCount = Number.parseInt(localStorage.getItem("skippedCount") || "0")

// History
const animeHistory = []
const MAX_HISTORY = 10 // Maximum number of anime to keep in history

// Declare setupEventListeners function
function setupEventListeners() {
  // Filter panel open/close
  filterButton.addEventListener("click", () => {
    filterPanel.classList.remove("hidden")
  })

  closeFilterButton.addEventListener("click", () => {
    filterPanel.classList.add("hidden")
  })

  // Genre search
  genreSearch.addEventListener("input", (e) => {
    filterGenres(e.target.value)
  })

  clearSearch.addEventListener("click", () => {
    genreSearch.value = ""
    filterGenres("")
  })

  // Clear selected genres
  clearGenres.addEventListener("click", () => {
    selectedGenres.clear()
    bannedGenres.clear()
    displayGenreButtons(allGenres)
    updateFilterBadge()
    isFilterChanged = true
  })

  // Reset filters
  resetFilters.addEventListener("click", () => {
    selectedGenres.clear()
    bannedGenres.clear()
    selectedType = ""
    selectedYear = ""
    selectedQuickFilter = ""

    // Reset button states
    typeFilterButtons.forEach((button) => button.classList.remove("active"))
    quickFilterButtons.forEach((button) => button.classList.remove("active"))

    // Reset year filter
    yearFilter.value = ""

    displayGenreButtons(allGenres)
    updateFilterBadge()
    isFilterChanged = true
  })

  // Apply filters
  applyFilters.addEventListener("click", () => {
    filterPanel.classList.add("hidden")

    if (isFilterChanged) {
      resetQueue()
      fetchMoreAnime()
      isFilterChanged = false
    }
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
      // Remove active class from other buttons
      quickFilterButtons.forEach((btn) => btn.classList.remove("active"))

      // Set active class on this button
      button.classList.add("active")

      selectedQuickFilter = button.dataset.filter
      updateFilterBadge()
      isFilterChanged = true

      resetQueue()
      fetchMoreAnime()
    })
  })

  // Type filter buttons
  typeFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from other buttons
      typeFilterButtons.forEach((btn) => btn.classList.remove("active"))

      // Set active class on this button
      button.classList.add("active")

      selectedType = button.dataset.type
      updateFilterBadge()
      isFilterChanged = true

      resetQueue()
      fetchMoreAnime()
    })
  })

  // Like/Dislike buttons
  likeButton.addEventListener("click", () => {
    if (currentCard) {
      // Simulate swipe right
      currentCard.style.transition = "transform 0.5s ease"
      currentCard.style.transform = `translate(${window.innerWidth}px, 0) rotate(10deg)`
      const anime = animeQueue[0] // Get the anime from the queue
      if (anime) {
        addToHistory(anime, "like")
        markAsSeen(anime.title)
        handleSwipeAnimation("right")

        // Update stats
        likedCount++
        // Add the number of episodes from this anime to the total
        const episodeCount = anime.episodes || 1 // Default to 1 if unknown
        episodesCount += episodeCount
        localStorage.setItem("episodesCount", episodesCount.toString())
        localStorage.setItem("likedCount", likedCount.toString())
        updateStats()
      }
    }
  })

  dislikeButton.addEventListener("click", () => {
    if (currentCard) {
      // Simulate swipe left
      currentCard.style.transition = "transform 0.5s ease"
      currentCard.style.transform = `translate(-${window.innerWidth}px, 0) rotate(-10deg)`
      const anime = animeQueue[0] // Get the anime from the queue
      if (anime) {
        addToHistory(anime, "dislike")
        handleSwipeAnimation("left")

        // Update stats
        skippedCount++
        localStorage.setItem("skippedCount", skippedCount.toString())
        updateStats()
      }
    }
  })

  // Undo button
  undoButton.addEventListener("click", undoLastAction)

  // Clear all button
  clearAllButton.addEventListener("click", clearAllAnime)

  // Generate PDF button
  generatePdfButton.addEventListener("click", generatePDF)

  // Infinite scroll (only on non-desktop)
  window.addEventListener("scroll", () => {
    if (!isDesktop && window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
      fetchMoreAnime()
    }
  })
}

// Initialize the app
async function initApp() {
  await fetchGenres()
  await fetchMoreAnime()
  setupEventListeners()
  updateStats()

  // Check if we're on desktop and adjust UI accordingly
  checkDesktopMode()
  window.addEventListener("resize", checkDesktopMode)

  // Initialize history list
  updateHistoryList()
}

// Check if we're in desktop mode and adjust UI
function checkDesktopMode() {
  isDesktop = window.innerWidth >= 1024

  // On desktop, we always show the filter panel
  if (isDesktop) {
    filterPanel.classList.remove("hidden")
    // Hide the filter button on desktop as it's not needed
    filterButton.style.display = "none"
    // Update the history list
    updateHistoryList()
  } else {
    filterPanel.classList.add("hidden")
    filterButton.style.display = "flex"
  }
}

// Update stats display
function updateStats() {
  if (likedCountElement) {
    likedCountElement.textContent = likedCount
  }
  if (episodesCountElement) {
    episodesCountElement.textContent = episodesCount
  }
  if (totalCountElement) {
    totalCountElement.textContent = likedCount + skippedCount
  }

  // Update desktop stats
  if (desktopLikedCount) {
    desktopLikedCount.textContent = likedCount
  }
  if (desktopEpisodesCount) {
    desktopEpisodesCount.textContent = episodesCount
  }

  // Update history list
  updateHistoryList()
}

// Add this function to update the history list in the details panel
function updateHistoryList() {
  if (!animeHistoryList || !isDesktop) return

  // Clear the empty state if we have history items
  if (animeHistory.length > 0) {
    const emptyState = animeHistoryList.querySelector(".empty-state")
    if (emptyState) {
      animeHistoryList.removeChild(emptyState)
    }
  }

  // Clear existing history items
  const existingItems = animeHistoryList.querySelectorAll(".history-item")
  existingItems.forEach((item) => item.remove())

  // Add history items
  animeHistory.forEach((historyItem, index) => {
    const anime = historyItem.anime
    const action = historyItem.action

    const listItem = document.createElement("li")
    listItem.classList.add("history-item")

    const image = document.createElement("img")
    image.src = anime.images.jpg.small_image_url || anime.images.jpg.image_url
    image.alt = anime.title
    image.classList.add("history-item-image")

    const infoDiv = document.createElement("div")
    infoDiv.classList.add("history-item-info")

    const title = document.createElement("div")
    title.classList.add("history-item-title")
    title.textContent = anime.title

    const meta = document.createElement("div")
    meta.classList.add("history-item-meta")
    const year = anime.aired && anime.aired.from ? new Date(anime.aired.from).getFullYear() : "?"
    meta.textContent = `${anime.type || "TV"} · ${year} · Score: ${anime.score || "?"}`

    infoDiv.appendChild(title)
    infoDiv.appendChild(meta)

    const actionDiv = document.createElement("div")
    actionDiv.classList.add("history-item-action")

    if (action === "like") {
      actionDiv.classList.add("like")
      actionDiv.innerHTML = '<i class="fas fa-check"></i>'
    } else {
      actionDiv.classList.add("dislike")
      actionDiv.innerHTML = '<i class="fas fa-times"></i>'
    }

    listItem.appendChild(image)
    listItem.appendChild(infoDiv)
    listItem.appendChild(actionDiv)

    animeHistoryList.appendChild(listItem)
  })

  // Add empty state if no history
  if (animeHistory.length === 0) {
    const emptyState = document.createElement("div")
    emptyState.classList.add("empty-state")
    emptyState.innerHTML = `
      <i class="fas fa-list"></i>
      <p>Your anime history will appear here as you swipe</p>
    `
    animeHistoryList.appendChild(emptyState)
  }
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

    // Check if this genre is already selected or banned
    if (selectedGenres.has(Number.parseInt(genre.mal_id))) {
      button.classList.add("active")
    } else if (bannedGenres.has(Number.parseInt(genre.mal_id))) {
      button.classList.add("banned")
    }

    button.addEventListener("click", () => {
      const genreId = Number.parseInt(genre.mal_id)

      // Toggle between three states: not selected -> selected -> banned -> not selected
      if (selectedGenres.has(genreId)) {
        // If selected, change to banned
        selectedGenres.delete(genreId)
        bannedGenres.add(genreId)
        button.classList.remove("active")
        button.classList.add("banned")
      } else if (bannedGenres.has(genreId)) {
        // If banned, change to not selected
        bannedGenres.delete(genreId)
        button.classList.remove("banned")
      } else {
        // If not selected, change to selected
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
  let filterCount = selectedGenres.size + bannedGenres.size
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

    // Add genre filter for included genres
    if (selectedGenres.size > 0) {
      const genresParam = Array.from(selectedGenres).join(",")
      url += `&genres=${genresParam}`
    }

    // Add genre filter for excluded genres
    if (bannedGenres.size > 0) {
      const genresParam = Array.from(bannedGenres).join(",")
      url += `&genres_exclude=${genresParam}`
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
  animeImage.classList.add("anime-image")

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

  // Set up event listeners for the image to prevent swipe gestures
  setupImageEventListeners(animeImage)

  // Set up Hammer.js for swipe gestures on the card
  setupSwipeGestures(animeCard, anime)

  // Fetch more anime if queue is getting low
  if (animeQueue.length < 3) {
    fetchMoreAnime()
  }

  // Update undo button state
  updateUndoButtonState()
}

// Set up event listeners for the image to prevent swipe gestures
function setupImageEventListeners(imageElement) {
  // Prevent all mouse and touch events on the image from propagating
  ;["mousedown", "touchstart", "click", "dragstart"].forEach((eventType) => {
    imageElement.addEventListener(
      eventType,
      (e) => {
        e.stopPropagation()
        isImageInteraction = true

        // For touch events, we need to set a flag and clear it after a delay
        if (eventType === "touchstart") {
          setTimeout(() => {
            isImageInteraction = false
          }, 300)
        }
      },
      { passive: false },
    )
  })

  // Prevent default behavior for drag events to avoid browser's native drag
  imageElement.addEventListener("dragstart", (e) => {
    e.preventDefault()
  })

  // Listen for mouseup and touchend on the document to reset the flag
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      isImageInteraction = false
    }, 100)
  })

  document.addEventListener("touchend", () => {
    setTimeout(() => {
      isImageInteraction = false
    }, 100)
  })
}

// Set up swipe gestures with Hammer.js
function setupSwipeGestures(element, anime) {
  // Declare Hammer if it's not already declared globally
  let hammer

  // Check if Hammer is defined globally
  if (typeof Hammer !== "undefined") {
    hammer = new Hammer(element)
  } else {
    console.error("Hammer.js is not loaded. Make sure it's included in your HTML.")
    return
  }

  hammer.get("pan").set({ direction: Hammer.DIRECTION_HORIZONTAL })

  // Add this line to prevent tap events from triggering swipes
  hammer.get("tap").set({ enable: false })

  // Disable press events as well
  hammer.get("press").set({ enable: false })

  let xPos = 0
  let yPos = 0
  let rotation = 0
  let isDragging = false

  hammer.on("panstart", (e) => {
    // Don't start dragging if the interaction started on the image
    if (isImageInteraction) {
      e.preventDefault()
      return
    }

    isDragging = true
  })

  hammer.on("pan", (e) => {
    // Don't process pan events if we're animating or if the interaction started on the image
    if (isAnimating || isImageInteraction) return

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
    // Don't process panend events if the interaction started on the image
    if (isImageInteraction) return

    element.style.transition = "transform 0.5s ease"
    isDragging = false

    // Only count as a swipe if there's sufficient velocity or distance
    const isSignificantSwipe = Math.abs(e.velocity) > 0.3 || Math.abs(xPos) > 100

    if (xPos > 100 && isSignificantSwipe) {
      // Swiped right (like)
      element.style.transform = `translate(${window.innerWidth}px, ${yPos}px) rotate(${rotation}deg)`
      // Add to history before marking as seen
      addToHistory(anime, "like")
      markAsSeen(anime.title)
      handleSwipeAnimation("right")

      // Update stats
      likedCount++
      // Add the number of episodes from this anime to the total
      const episodeCount = anime.episodes || 1 // Default to 1 if unknown
      episodesCount += episodeCount
      localStorage.setItem("episodesCount", episodesCount.toString())
      localStorage.setItem("likedCount", likedCount.toString())
      updateStats()
    } else if (xPos < -100 && isSignificantSwipe) {
      // Swiped left (dislike)
      element.style.transform = `translate(-${window.innerWidth}px, ${yPos}px) rotate(${rotation}deg)`
      // Add to history
      addToHistory(anime, "dislike")
      handleSwipeAnimation("left")

      // Update stats
      skippedCount++
      localStorage.setItem("skippedCount", skippedCount.toString())
      updateStats()
    } else {
      // Return to center if not swiped far enough
      element.style.transform = "translate(0, 0) rotate(0deg)"
      const indicators = element.querySelectorAll(".swipe-indicator")
      indicators.forEach((indicator) => indicator.classList.add("hidden"))
    }
  })

  // Add a click handler to the card itself (but not for the image)
  element.addEventListener("click", (e) => {
    // Only process the click if it's not on the image
    if (!e.target.classList.contains("anime-image")) {
      e.preventDefault()
      e.stopPropagation()
    }
  })
}

// Add anime to history for undo functionality
function addToHistory(anime, action) {
  animeHistory.unshift({
    anime: anime,
    action: action,
  })

  // Limit history size
  if (animeHistory.length > MAX_HISTORY) {
    animeHistory.pop()
  }

  // Enable undo button
  updateUndoButtonState()

  // Update history list in the details panel
  updateHistoryList()
}

// Update undo button state (enabled/disabled)
function updateUndoButtonState() {
  if (animeHistory.length > 0) {
    undoButton.classList.remove("disabled")
  } else {
    undoButton.classList.add("disabled")
  }
}

// Undo last action
function undoLastAction() {
  if (animeHistory.length === 0 || isAnimating) return

  const lastAction = animeHistory.shift()

  // If the last action was a like, remove from seen list
  if (lastAction.action === "like") {
    seenTitles.delete(lastAction.anime.title)
    // Update localStorage
    localStorage.setItem("seenAnime", JSON.stringify(Array.from(seenTitles)))

    // Update stats
    likedCount = Math.max(0, likedCount - 1)
    if (lastAction.action === "like") {
      // Add the number of episodes from this anime to the total
      const episodeCount = lastAction.anime.episodes || 1 // Default to 1 if unknown
      episodesCount += episodeCount
      localStorage.setItem("episodesCount", episodesCount.toString())
    }
    localStorage.setItem("likedCount", likedCount.toString())
  } else {
    // If it was a dislike, update skipped count
    skippedCount = Math.max(0, skippedCount - 1)
    localStorage.setItem("skippedCount", skippedCount.toString())
  }

  updateStats()

  // Add the anime back to the beginning of the queue
  animeQueue.unshift(lastAction.anime)

  // Remove current card and show the previous one
  if (currentCard) {
    animeCardContainer.removeChild(currentCard)
    currentCard = null
  }

  // Show the anime that was undone
  showNextAnime()

  // Update undo button state
  updateUndoButtonState()

  // Update history list
  updateHistoryList()
}

// Handle swipe animation and show next card
function handleSwipeAnimation(direction) {
  isAnimating = true

  // Prepare the next card immediately but keep it hidden
  const nextAnimeCard = document.createElement("div")
  nextAnimeCard.classList.add("anime-card")
  nextAnimeCard.style.opacity = "0"

  if (animeQueue.length > 0) {
    const nextAnime = animeQueue[0]

    // Create like/dislike indicators for next card
    const likeIndicator = document.createElement("div")
    likeIndicator.classList.add("swipe-indicator", "like", "hidden")
    likeIndicator.textContent = "LIKE"

    const dislikeIndicator = document.createElement("div")
    dislikeIndicator.classList.add("swipe-indicator", "dislike", "hidden")
    dislikeIndicator.textContent = "NOPE"

    // Create anime image for next card
    const animeImage = document.createElement("img")
    animeImage.src = nextAnime.images.jpg.large_image_url || nextAnime.images.jpg.image_url
    animeImage.alt = nextAnime.title
    animeImage.classList.add("anime-image")

    // Create anime info section for next card
    const animeInfo = document.createElement("div")
    animeInfo.classList.add("anime-info")

    const animeTitle = document.createElement("h3")
    animeTitle.textContent = nextAnime.title

    const animeDetails = document.createElement("p")
    const year = nextAnime.aired && nextAnime.aired.from ? new Date(nextAnime.aired.from).getFullYear() : "?"
    animeDetails.textContent = `${nextAnime.type || "TV"} · ${year} · ${nextAnime.episodes || "?"} eps · ${nextAnime.score || "?"}/10`

    // Assemble the next card
    animeInfo.appendChild(animeTitle)
    animeInfo.appendChild(animeDetails)
    nextAnimeCard.appendChild(likeIndicator)
    nextAnimeCard.appendChild(dislikeIndicator)
    nextAnimeCard.appendChild(animeImage)
    nextAnimeCard.appendChild(animeInfo)

    // Add the next card to the container behind the current card
    animeCardContainer.appendChild(nextAnimeCard)
  }

  // Wait for current card animation to complete
  setTimeout(() => {
    // Remove the current card
    if (currentCard) {
      animeCardContainer.removeChild(currentCard)
      currentCard = null
    }

    // If we prepared a next card, make it visible with a fade-in effect
    if (animeQueue.length > 0) {
      nextAnimeCard.style.transition = "opacity 0.3s ease"
      nextAnimeCard.style.opacity = "1"
      currentCard = nextAnimeCard

      // Set up event listeners for the image to prevent swipe gestures
      const nextImage = nextAnimeCard.querySelector(".anime-image")
      if (nextImage) {
        setupImageEventListeners(nextImage)
      }

      // Set up Hammer.js for swipe gestures on the card
      setupSwipeGestures(nextAnimeCard, animeQueue[0])

      // Remove the first anime from the queue since we're showing it now
      animeQueue.shift()

      // Fetch more anime if queue is getting low
      if (animeQueue.length < 3) {
        fetchMoreAnime()
      }

      // Update undo button state
      updateUndoButtonState()
    } else {
      // If no more anime in queue, show loading and fetch more
      animeCardContainer.innerHTML = '<div id="loading">Loading more anime...</div>'
      fetchMoreAnime()
    }

    isAnimating = false
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

    // Reset stats
    likedCount = 0
    episodesCount = 0
    localStorage.setItem("episodesCount", "0")
    skippedCount = 0
    localStorage.setItem("likedCount", "0")
    localStorage.setItem("skippedCount", "0")

    // Clear history
    animeHistory.length = 0

    updateStats()
    updateHistoryList()

    alert("Your anime list has been cleared!")
  }
}

// Replace the generatePDF function with this improved version that groups anime by series

// Generate PDF of seen anime
function generatePDF() {
  const seenAnime = Array.from(seenTitles)
  if (seenAnime.length === 0) {
    alert("No anime marked as seen yet.")
    return
  }

  // Declare jsPDF if it's not already declared globally
  const { jsPDF } = window.jspdf

  // Create a new document with slightly larger page size
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  // Add a title with styling
  doc.setFillColor(255, 51, 102) // Pink color matching the app theme
  doc.rect(0, 0, 210, 25, "F")

  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("My Anime List", 105, 15, { align: "center" })

  // Add stats summary
  doc.setFillColor(245, 245, 245) // Light gray background
  doc.rect(0, 25, 210, 20, "F")

  doc.setTextColor(80, 80, 80) // Dark gray text
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")

  const today = new Date().toLocaleDateString()
  const totalAnime = seenAnime.length

  doc.text(`Generated on: ${today}`, 15, 35)
  doc.text(`Total Anime: ${totalAnime}`, 15, 42)
  doc.text(`Total Episodes: ${episodesCount}`, 105, 42)

  // Group anime by series
  const groupedAnime = groupAnimeBySeries(seenAnime)

  // Add column headers
  doc.setFillColor(240, 240, 240)
  doc.rect(15, 50, 180, 10, "F")

  doc.setFont("helvetica", "bold")
  doc.setTextColor(80, 80, 80)
  doc.text("No.", 20, 57)
  doc.text("Anime Title", 40, 57)

  // Add anime list with alternating row colors
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(50, 50, 50)

  let yPos = 67
  const itemsPerPage = 35
  let currentPage = 1
  let itemCount = 0

  // Process each series group
  Object.entries(groupedAnime).forEach(([seriesName, seasons], seriesIndex) => {
    // Check if we need a new page
    if (itemCount > 0 && yPos > 270) {
      addNewPage()
      itemCount = 0
    }

    // Add series name with highlight
    doc.setFillColor(240, 248, 255) // Light blue background for series headers
    doc.rect(15, yPos - 6, 180, 8, "F")
    doc.setFont("helvetica", "bold")
    doc.setTextColor(70, 130, 180) // Steel blue text for series name
    doc.text(`${seriesIndex + 1}. ${seriesName}`, 20, yPos)

    yPos += 8
    itemCount++

    // Add each season under the series
    seasons.forEach((title, seasonIndex) => {
      // Check if we need a new page
      if (itemCount > 0 && yPos > 270) {
        addNewPage()
        itemCount = 0
      }

      // Add alternating row background for seasons
      if (seasonIndex % 2 === 1) {
        doc.setFillColor(248, 248, 248)
        doc.rect(15, yPos - 6, 180, 8, "F")
      }

      // Add season with indent
      doc.setFont("helvetica", "normal")
      doc.setTextColor(50, 50, 50)

      // Handle long titles
      const maxWidth = 150 // Maximum width for title (reduced to account for indent)
      const displayTitle = title.replace(new RegExp(`^${escapeRegExp(seriesName)}\\s*[:|-]?\\s*`), "")

      if (doc.getTextWidth(displayTitle) > maxWidth) {
        // Truncate long titles
        let truncatedTitle = displayTitle
        while (doc.getTextWidth(truncatedTitle + "...") > maxWidth && truncatedTitle.length > 0) {
          truncatedTitle = truncatedTitle.slice(0, -1)
        }
        doc.text(`${truncatedTitle}...`, 45, yPos) // Indented
      } else {
        doc.text(displayTitle || title, 45, yPos) // Indented
      }

      yPos += 8
      itemCount++
    })
  })

  // Add footer with page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" })
  }

  // Save the PDF
  doc.save("my_anime_list.pdf")

  // Helper function to add a new page with headers
  function addNewPage() {
    doc.addPage()
    currentPage++
    yPos = 20 // Reset Y position for new page

    // Add page header
    doc.setFillColor(245, 245, 245)
    doc.rect(0, 0, 210, 15, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(80, 80, 80)
    doc.text(`My Anime List - Page ${currentPage}`, 105, 10, { align: "center" })

    // Add column headers on new page
    doc.setFillColor(240, 240, 240)
    doc.rect(15, 15, 180, 10, "F")
    doc.text("No.", 20, 22)
    doc.text("Anime Title", 40, 22)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(50, 50, 50)

    yPos = 32 // Start items after the header
  }
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Group anime by series
function groupAnimeBySeries(animeList) {
  const seriesGroups = {}
  const processedTitles = new Set()

  // First pass: identify main series
  animeList.forEach((title) => {
    if (processedTitles.has(title)) return

    // Extract base series name (remove season indicators, numbers, etc.)
    const baseSeriesName = extractBaseSeriesName(title)

    if (!seriesGroups[baseSeriesName]) {
      seriesGroups[baseSeriesName] = []
    }

    // Find all related titles
    const relatedTitles = findRelatedTitles(animeList, baseSeriesName)

    // Add all related titles to this series group
    relatedTitles.forEach((relatedTitle) => {
      seriesGroups[baseSeriesName].push(relatedTitle)
      processedTitles.add(relatedTitle)
    })
  })

  // Sort each series internally by season/part number
  Object.keys(seriesGroups).forEach((seriesName) => {
    seriesGroups[seriesName].sort((a, b) => {
      return sortBySeason(a, b, seriesName)
    })
  })

  return seriesGroups
}

// Extract the base series name from a title
function extractBaseSeriesName(title) {
  // Remove common season indicators
  const baseName = title
    .replace(/\s+(Season|Series|Part|Cour)\s+\d+/i, "")
    .replace(/\s+S\d+/i, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+Season/i, "")
    .replace(/\s+$$TV$$|\s+TV$/i, "")
    .replace(/\s+\d+$/i, "")
    .replace(/\s+II+$/i, "")
    .replace(/\s+\d+\s*[:-].*$/i, "")
    .replace(/\s+[:-].*$/i, "")
    .trim()

  return baseName
}

// Find all titles related to a base series name
function findRelatedTitles(animeList, baseSeriesName) {
  const relatedTitles = []
  const baseNameLower = baseSeriesName.toLowerCase()

  animeList.forEach((title) => {
    const titleLower = title.toLowerCase()

    // Check if this title belongs to the series
    if (
      titleLower === baseNameLower ||
      titleLower.startsWith(baseNameLower + " ") ||
      titleLower.startsWith(baseNameLower + ":") ||
      titleLower.startsWith(baseNameLower + "-") ||
      titleLower.includes(" " + baseNameLower + " ") ||
      // Roman numerals
      titleLower.match(new RegExp(`^${escapeRegExp(baseNameLower)}\\s+[IVX]+$`)) ||
      // Season indicators
      titleLower.match(new RegExp(`^${escapeRegExp(baseNameLower)}\\s+(season|series|part|cour)`, "i")) ||
      titleLower.match(new RegExp(`^${escapeRegExp(baseNameLower)}\\s+s\\d+`, "i")) ||
      titleLower.match(new RegExp(`^${escapeRegExp(baseNameLower)}\\s+\\d+(st|nd|rd|th)\\s+season`, "i"))
    ) {
      relatedTitles.push(title)
    }
  })

  return relatedTitles
}

// Sort titles by season/part number
function sortBySeason(a, b, seriesName) {
  // Helper function to extract season number
  function getSeasonNumber(title) {
    // Remove the series name to focus on the season part
    const seasonPart = title.replace(seriesName, "").trim()

    // Check for roman numerals
    const romanMatch = seasonPart.match(/^[IVX]+$/)
    if (romanMatch) {
      return romanNumeralToInt(romanMatch[0])
    }

    // Check for "Season X" or "SX" format
    const seasonMatch = seasonPart.match(/Season\s+(\d+)|S(\d+)/i)
    if (seasonMatch) {
      return Number.parseInt(seasonMatch[1] || seasonMatch[2])
    }

    // Check for ordinal format (1st, 2nd, 3rd Season)
    const ordinalMatch = seasonPart.match(/(\d+)(st|nd|rd|th)\s+Season/i)
    if (ordinalMatch) {
      return Number.parseInt(ordinalMatch[1])
    }

    // Check for simple number at the end
    const numberMatch = seasonPart.match(/\s+(\d+)$/)
    if (numberMatch) {
      return Number.parseInt(numberMatch[1])
    }

    // Check for "Part X" format
    const partMatch = seasonPart.match(/Part\s+(\d+)/i)
    if (partMatch) {
      return Number.parseInt(partMatch[1])
    }

    // If no season number found, return 0 for original series
    return title === seriesName ? 0 : 999 // Put unidentified seasons at the end
  }

  return getSeasonNumber(a) - getSeasonNumber(b)
}

// Convert Roman numeral to integer
function romanNumeralToInt(roman) {
  const romanValues = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  }

  let result = 0

  for (let i = 0; i < roman.length; i++) {
    const current = romanValues[roman[i]]
    const next = romanValues[roman[i + 1]]

    if (next && current < next) {
      result += next - current
      i++
    } else {
      result += current
    }
  }

  return result
}

// Start the app
initApp()
