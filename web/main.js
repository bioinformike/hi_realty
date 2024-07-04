let map, markers = [], data = []; 

let currentType = 'Long Term';
let popup_w = 600;
let popup_h = 600;



document.addEventListener('DOMContentLoaded', function() {
  initMap();
  loadData();
  initSidebar();
});

function initMap() {
  map = L.map('map').setView([21.467, -157.983], 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    zoomControl: false,
  }).addTo(map);

  map.zoomControl.setPosition('bottomright');
}

function updateMap() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  const minPriceElement = document.getElementById('minPrice');
  const maxPriceElement = document.getElementById('maxPrice');
  const bedroomsElement = document.getElementById('bedrooms');
  const fullBathsElement = document.getElementById('fullBaths');
  const halfBathsElement = document.getElementById('halfBaths');
  const parkingElement = document.getElementById('parking');

  const minPrice = minPriceElement ? parseFloat(minPriceElement.value) : 0;
  const maxPrice = maxPriceElement ? parseFloat(maxPriceElement.value) : Infinity;
  const bedrooms = bedroomsElement ? parseInt(bedroomsElement.value) : 0;
  const fullBaths = fullBathsElement ? parseInt(fullBathsElement.value) : 0;
  const halfBaths = halfBathsElement ? parseInt(halfBathsElement.value) : 0;
  const parking = parkingElement ? parseInt(parkingElement.value) : 0;

  const filteredData = data.filter(property => {
    const price = parseFloat(property.curr_price.replace(/[^0-9.-]+/g, ""));
    return price >= minPrice && price <= maxPrice &&
           parseInt(property.bedrooms) >= bedrooms &&
           parseInt(property.full_baths) >= fullBaths &&
           parseInt(property.half_baths) >= halfBaths &&
           parseInt(property.parking) >= parking;
  });

  filteredData.forEach(property => {
    const lat = parseFloat(property.lat);
    const lon = parseFloat(property.lon);
    const marker = L.marker([lat, lon]).addTo(map);
    
    const popupContent = createPopupContent(property);
    const options = {minWidth: popup_w, maxWidth: popup_w, 
                     minHeight: popup_h, maxHeight: popup_h};
    marker.bindPopup(popupContent, options);
    markers.push(marker);
  });
}

function createPopupContent(property) {
  const imgUrlsString = property.img_urls.replace(/'/g, '"');
  const imgUrls = JSON.parse(imgUrlsString);
  const carouselId = `carousel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const halfBathsLine = property.half_baths > 0 ? `<p class=popup-datum>Half Baths: ${property.half_baths}</p>` : '';

  return `
    <div>
      <h4>${property.clean_full_add}</h4>
      <p class=popup-datum>Bedrooms: ${property.bedrooms}</p>
      <p class=popup-datum>Full Baths: ${property.full_baths}</p>
      ${halfBathsLine}
      <p class=popup-datum>Price: ${property.curr_price}</p>
      <p class=popup-datum>Parking Spots: ${property.parking}</p>
      <div id="${carouselId}" class="carousel slide" data-ride="carousel" data-interval="false">
        <div class="carousel-inner">
          ${imgUrls.map((url, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
              <img src="${url}" class="d-block w-100" alt="Property Image">
            </div>
          `).join('')}
        </div>
        <a class="carousel-control-prev" href="#${carouselId}" role="button" data-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="sr-only">Previous</span>
        </a>
        <a class="carousel-control-next" href="#${carouselId}" role="button" data-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="sr-only">Next</span>
        </a>
      </div>
    </div>
  `;
}


function loadData() {
  console.log('Starting to load data...');
  Papa.parse('./assets/latest_home_data.tsv', {
    download: true,
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
    complete: function(results) {
      console.log('Papa Parse complete. Raw results:', results);
      if (results.errors && results.errors.length > 0) {
        console.error('Papa Parse encountered errors:', results.errors);
      }
      if (results.data && results.data.length > 0) {
        data = results.data.filter(row => {
          return row.lat !== 'NA' && row.lon !== 'NA' && row.active_status_str === 'Active';
        });
        console.log(`Filtered data. ${data.length} rows remaining.`);
        initializeFilters();
        initFilters();
        updateMap();
      } else {
        console.error('No data was parsed from the file.');
      }
    },
    error: function(error) {
      console.error('Error occurred while parsing:', error);
    }
  });
}

function initializeFilters() {
  const priceValues = data.map(d => parseFloat(d.curr_price.replace(/[^0-9.-]+/g, "")));
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');
  const priceRangeMin = document.getElementById('priceRangeMin');
  const priceRangeMax = document.getElementById('priceRangeMax');

  if (minPriceInput && maxPriceInput && priceRangeMin && priceRangeMax) {
    minPriceInput.value = minPrice;
    maxPriceInput.value = maxPrice;
    priceRangeMin.min = minPrice;
    priceRangeMin.max = maxPrice;
    priceRangeMin.value = minPrice;
    priceRangeMax.min = minPrice;
    priceRangeMax.max = maxPrice;
    priceRangeMax.value = maxPrice;
  }

  ['bedrooms', 'fullBaths', 'halfBaths', 'parking'].forEach(field => {
    const slider = document.getElementById(field);
    if (slider) {
      const max = Math.max(...data.map(d => parseInt(d[field]) || 0));
      slider.max = max;
    }
  });
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  
  if (sidebar) {
    sidebar.classList.remove('collapsed');
  }
  
  if (sidebar && sidebarToggle) {
    sidebarToggle.onclick = function() {
      sidebar.classList.toggle('collapsed');
      sidebarToggle.querySelector('img').src = sidebar.classList.contains('collapsed') 
        ? 'assets/arrow-square-right.svg' 
        : 'assets/arrow-square-left.svg';
      setTimeout(() => map.invalidateSize(), 300);
    };
  }
}

function initFilters() {
  const priceRangeMin = document.getElementById('priceRangeMin');
  const priceRangeMax = document.getElementById('priceRangeMax');
  const minPriceInput = document.getElementById('minPrice');
  const maxPriceInput = document.getElementById('maxPrice');

  if (priceRangeMin && priceRangeMax && minPriceInput && maxPriceInput) {
    [priceRangeMin, priceRangeMax, minPriceInput, maxPriceInput].forEach(el => {
      el.addEventListener('input', updatePriceRange);
    });
  }

  ['bedrooms', 'fullBaths', 'halfBaths', 'parking'].forEach(field => {
    const slider = document.getElementById(field);
    const valueSpan = document.getElementById(`${field}Value`);
    if (slider && valueSpan) {
      slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value > 0 ? `${slider.value}+` : 'Any';
      });
    }
  });

  const applyFiltersButton = document.getElementById('applyFilters');
  if (applyFiltersButton) {
    applyFiltersButton.addEventListener('click', updateMap);
  }
}

function updatePriceRange() {
  const minPrice = parseFloat(minPriceInput.value);
  const maxPrice = parseFloat(maxPriceInput.value);
  
  priceRangeMin.value = minPrice;
  priceRangeMax.value = maxPrice;
  
  if (minPrice > maxPrice) {
    maxPriceInput.value = minPrice;
    priceRangeMax.value = minPrice;
  }
}