let map, markers = [], data = [];
let currentType = 'Long Term';
let popup_w = 600;
let popup_h = 600;

document.addEventListener('DOMContentLoaded', function() {
  initMap();
  loadData().then(() => {
    initSidebar();
    updateMap();
  });
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

function loadData() {
  return new Promise((resolve, reject) => {
    Papa.parse('./assets/latest_home_data.tsv', {
      download: true,
      header: true,
      delimiter: '\t',
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors && results.errors.length > 0) {
          console.error('Papa Parse encountered errors:', results.errors);
        }
        if (results.data && results.data.length > 0) {
          data = results.data.filter(row => 
            row.lat !== 'NA' && 
            row.lon !== 'NA' && 
            row.active_status_str === 'Active'
          );
          // Make sure pets_allowed is properly parsed
          data.forEach(row => {
            row.pets_allowed = row.pets_allowed === 'Yes' ? 'Yes' : 'No';
          });
          resolve();
        } else {
          reject('No data was parsed from the file.');
        }
      },
      error: function(error) {
        reject('Error occurred while parsing: ' + error);
      }
    });
  });
}

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const toggleIcon = sidebarToggle.querySelector('i');
  const filterIcons = sidebar.querySelectorAll('.filter-item label i');
  filterIcons.forEach(icon => {
    icon.addEventListener('click', function(event) {
      if (sidebar.classList.contains('collapsed')) {
        event.preventDefault();
        expandSidebar();
      }
    });
  });
  
  const petsCheckbox = document.getElementById('pets-allowed');
  const petsIcon = document.getElementById('pets-icon');
  
  if (sidebar && sidebarToggle) {
    sidebarToggle.onclick = function() {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      
      // Toggle icon
      if (isCollapsed) {
        toggleIcon.classList.remove('fa-square-caret-left');
        toggleIcon.classList.add('fa-square-caret-right');
        sidebarToggle.style.left = '60px';
      } else {
        toggleIcon.classList.remove('fa-square-caret-right');
        toggleIcon.classList.add('fa-square-caret-left');
        sidebarToggle.style.left = '275px';
      }
      
      // Adjust map size
      setTimeout(() => {
        map.invalidateSize();
        if (!isCollapsed) {
          Object.values(map._layers).forEach(layer => {
            if (layer instanceof L.Marker) {
              layer.closePopup();
            }
          });
        }
      }, 300);

      // Show/hide slider containers and checkbox
      document.querySelectorAll('.filter-item .slider-container, .pets-filter input[type="checkbox"]').forEach(element => {
        element.style.display = isCollapsed ? 'none' : 'block';
      });
    };
  }

  // Add event listener for the pets checkbox
  if (petsCheckbox && petsIcon) {
    petsCheckbox.addEventListener('change', function() {
      updateMap();
      petsIcon.classList.toggle('pets-allowed-checked', this.checked);
    });
  }

  createSliders();
}



function createSliders() {
  const sliderConfigs = {
    'price-range-slider': { min: 0, max: 1000000, step: 1000, field: 'curr_price' },
    'bedrooms-slider': { min: 0, max: 10, step: 1, field: 'bedrooms' },
    'fullbaths-slider': { min: 0, max: 5, step: 1, field: 'full_baths' },
    'halfbaths-slider': { min: 0, max: 3, step: 1, field: 'half_baths' },
    'parking-slider': { min: 0, max: 5, step: 1, field: 'parking' }
  };

  Object.entries(sliderConfigs).forEach(([id, config]) => {
    const { min, max, step } = getDataRange(id, config);
    createSlider(id, min, max, step);
  });
}

function getDataRange(id, config) {
  if (id === 'price-range-slider') {
    const prices = data.map(d => parseFloat(d[config.field].replace(/[^0-9.-]+/g, "")));
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      step: config.step
    };
  } else {
    const values = data.map(d => parseInt(d[config.field]) || 0);
    return {
      min: 0,
      max: Math.max(...values, config.max),
      step: config.step
    };
  }
}

function createSlider(id, min, max, step) {
  const slider = document.getElementById(id);
  if (!slider) {
    console.error(`Slider element with id ${id} not found`);
    return;
  }
  
  const isPrice = id === 'price-range-slider';
  const pipsConfig = getPipsConfig(id, min, max, step, isPrice);

  noUiSlider.create(slider, {
    start: isPrice ? [min, max] : [min],
    connect: isPrice ? true : 'lower',
    step: step,
    range: { 'min': min, 'max': max },
    format: {
      to: value => isPrice ? parseInt(value) : Math.round(value),
      from: value => isPrice ? parseInt(value) : Math.round(parseFloat(value))
    },
    pips: getPipsConfig(id, min, max, step, isPrice)
  });

  const valueElement = document.getElementById(`${id}-value`);
  if (valueElement) {
    slider.noUiSlider.on('update', function(values) {
      if (isPrice) {
        valueElement.textContent = `$${parseInt(values[0]).toLocaleString()} - $${parseInt(values[1]).toLocaleString()}`;
      } else {
        valueElement.textContent = values[0] > min ? `${values[0]}+` : 'Any';
      }
    });
  }

  slider.noUiSlider.on('change', updateMap);
}

function getPipsConfig(id, min, max, step, isPrice) {
  let values, density;

  switch(id) {
    case 'price-range-slider':
      values = [0, 500000, 1000000, 1500000, 2000000, 3000000];
      density = 3;
      break;
    case 'bedrooms-slider':
    case 'fullbaths-slider':
    case 'halfbaths-slider':
    case 'parking-slider':
      values = Array.from({length: max - min + 1}, (_, i) => min + i);
      density = 100 / (max - min);
      break;
    default:
      values = [min, max];
      density = 100;
  }

  return {
    mode: 'values',
    values: values,
    density: density,
    stepped: true,
    format: {
      to: value => isPrice ? `$${value.toLocaleString()}` : Math.round(value)
    }
  };
}

function updateMap() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  const filters = getFilterValues();
  const filteredData = data.filter(property => filterProperty(property, filters));

  filteredData.forEach(property => {
    const lat = parseFloat(property.lat);
    const lon = parseFloat(property.lon);
    const marker = L.marker([lat, lon]).addTo(map);
    
    const popupContent = createPopupContent(property);
    const options = { minWidth: popup_w, maxWidth: popup_w, minHeight: popup_h, maxHeight: popup_h };
    marker.bindPopup(popupContent, options);
    markers.push(marker);
  });
}

function getFilterValues() {
  return {
    price: document.getElementById('price-range-slider').noUiSlider.get(),
    bedrooms: document.getElementById('bedrooms-slider').noUiSlider.get(),
    fullBaths: document.getElementById('fullbaths-slider').noUiSlider.get(),
    halfBaths: document.getElementById('halfbaths-slider').noUiSlider.get(),
    parking: document.getElementById('parking-slider').noUiSlider.get(),
    petsAllowed: document.getElementById('pets-allowed').checked
  };
}

function filterProperty(property, filters) {
  const price = parseFloat(property.curr_price.replace(/[^0-9.-]+/g, ""));
  return price >= filters.price[0] && price <= filters.price[1] &&
         parseInt(property.bedrooms) >= filters.bedrooms &&
         parseInt(property.full_baths) >= filters.fullBaths &&
         parseInt(property.half_baths) >= filters.halfBaths &&
         parseInt(property.parking) >= filters.parking &&
         (!filters.petsAllowed || property.pets_allowed === 'Yes');
}

function createPopupContent(property) {
  const imgUrlsString = property.img_urls.replace(/'/g, '"');
  const imgUrls = JSON.parse(imgUrlsString);
  const carouselId = `carousel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const halfBathsLine = property.half_baths > 0 ? `<p class="popup-datum"><strong>Half Baths:</strong> ${property.half_baths}</p>` : '';
  const petsAllowed = property.pets_allowed === 'Yes' 
    ? '<p class="popup-datum"><strong>Pets:</strong> Allowed</p>'
    : '<p class="popup-datum"><strong>Pets:</strong> Not allowed</p>';
  return `
    <div class="popup-content">
      <div class="popup-left">
        <p class="popup-header-item">${property.street_add}</p>
        <p class="popup-header-item">${property.city}</p>
      </div>
      <div class="popup-right">
        <p class="popup-header-item">Price: ${property.curr_price}</p>
        <p class="popup-header-item">Term: ${property.term}</p>
        <p class="popup-header-item">Deposit: ${property.deposit}</p>
        <p class="popup-header-item">Date Avail: ${property.curr_date}</p>
      </div>

      <div class="popup-left">
        <p class="popup-datum"><strong>Bedrooms:</strong> ${property.bedrooms}</p>
        <p class="popup-datum"><strong>Full Baths:</strong> ${property.full_baths}</p>
        ${halfBathsLine}
        <p class="popup-datum"><strong>Parking:</strong> ${property.parking}</p>
        <p class="popup-datum-addl">${property.parking_features}</p>
        <p class="popup-datum"><strong>Frontage:</strong> ${property.frontage}</p>
        <p class="popup-datum"><strong>View:</strong> ${property.view}</p>

      </div>
      
      <div class="popup-right">
        <p class="popup-datum"><strong>Neighborhood:</strong> ${property.hood}</p>
        <p class="popup-datum"><strong>Region:</strong> ${property.region}</p>
        ${petsAllowed}
        <p class="popup-datum"><strong>Furnished:</strong> ${property.furnished}</p>
      </div>
      
      <div class="popup-full">
        <p class="popup-datum-title">Unit Features:</p>
        <p class="popup-datum">${property.unit_features}</p>
        <p class="popup-datum-title">Amenities:</p>
        <p class="popup-datum">${property.amenities}</p>
      </div>
      <div class="popup-full">
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
      <div class="popup-full">
        <p class="popup-description">${property.description}</p>
      </div>
      <div class="popup-full">
        <p class="popup-datum popup-url"><a href="${property.orig_url}" target="_blank">View listing</a></p>
      </div>
    </div>
    
  `;
}

