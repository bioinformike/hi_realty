import { fetchTSV, parseTSV, min, max} from './helper.js';


// Initialize map
const map = L.map('map').setView([21.467, -157.983], 11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	subdomains: 'abcd',
	maxZoom: 20}).addTo(map);

  map.zoomControl.setPosition('bottomright');

const tsvPath = './assets/latest_home_data.tsv'; 
let df = null;

// Fetch and parse the TSV file
function fetchDataFrameSync() {
  let dataFrameLoaded = false;
  fetchTSV(tsvPath)
      .then(tsvContent => {
          consosle.log("Loaded dataframe, now parsing...")
          df = parseTSV(tsvContent);
          console.log('Parsing complete!', df);
          dataFrameLoaded = true;
      })
      .catch(error => {
          console.error('Error fetching or parsing the TSV file:', error);
      });

  // Synchronous loop that waits until the DataFrame is loaded
  let count = 0;
  while (!dataFrameLoaded) {
    console.log('Waiting for DataFrame to be loaded...loop count:', count);
    if (count > 10) {
      console.error('DataFrame load timed out');
      break;
    }  
    count++;
  }
  fetchDataFrameSync();


  // Once the loop exits, the DataFrame is loaded and available
  console.log('DataFrame is now available:', df);

  // Now you can execute code that depends on the DataFrame
  const minPrice = min(df, 'curr_price');
  const maxPrice = max(df, 'curr_price');

  console.log('Minimum price:', minPrice);
  console.log('Maximum price:', maxPrice);

  // Other code that depends on the DataFrame
}

fetchDataFrameSync();

const minPrice = min(df, 'curr_price');
const maxPrice = max(df, 'curr_price');

console.log('Minimum price:', minPrice);
console.log('Maximum price:', maxPrice);


fetchDataFrame().then(min); // Wait for DataFrame to be available before running calculateMinMax

// // Parse TSV and add markers
// Papa.parse('./assets/latest_home_data.tsv', {
//     download: true,
//     header: true,
//     complete: function(results) {
//       const data = results.data;
  
//       // Filter out rows with missing latitude or longitude
//       const filteredData = data.filter(property => {
//         return property.lat !== 'NA' && property.lon !== 'NA';
//       });
  
//       let min_price = 0;
//       let max_price = 0;
//       filteredData.forEach(property => {
//         const lat = parseFloat(property.lat);
//         const lon = parseFloat(property.long);
//         const address = property.clean_full_add;
//         const price = property.curr_price;
//         const bedrooms = property.bedrooms;
//         const fullBaths = property.full_baths;
//         const halfBaths = property.half_baths;
//         const parking = property.parking;
//         const imgUrls = property.img_urls.split(',').map(url => url.trim()); // Trim any whitespace
  
//         if (price < min_price) {
//           min_price = price;
//         } else if (price > max_price) {
//           max_price = price;
//       }
      

//         const popupContent = `
//           <div>
//             <h5>${address}</h5>
//             <p>Price: ${price}</p>
//             <p>Bedrooms: ${bedrooms}</p>
//             <p>Full Baths: ${fullBaths}</p>
//             <p>Half Baths: ${halfBaths}</p>
//             <p>Parking Spots: ${parking}</p>
//             <div id="carousel${lat}-${lon}" class="carousel slide" data-ride="carousel">
//               <div class="carousel-inner">
//                 ${imgUrls.map((url, index) => `
//                   <div class="carousel-item ${index === 0 ? 'active' : ''}">
//                     <img src="${url}" class="d-block w-100" alt="...">
//                   </div>
//                 `).join('')}
//               </div>
//               <a class="carousel-control-prev" href="#carousel${lat}-${lon}" role="button" data-slide="prev">
//                 <span class="carousel-control-prev-icon" aria-hidden="true"></span>
//                 <span class="sr-only">Previous</span>
//               </a>
//               <a class="carousel-control-next" href="#carousel${lat}-${lon}" role="button" data-slide="next">
//                 <span class="carousel-control-next-icon" aria-hidden="true"></span>
//                 <span class="sr-only">Next</span>
//               </a>
//             </div>
//           </div>
//         `;
  
//         L.marker([lat, lon]).addTo(map).bindPopup(popupContent);
//       });
  
//       // Set up range sliders
//       const priceRange = document.getElementById('priceRange');
//       const bedrooms = document.getElementById('bedrooms');
//       const fullBaths = document.getElementById('fullBaths');
//       const halfBaths = document.getElementById('halfBaths');
//       const parking = document.getElementById('parking');
  
//       const priceValues = filteredData.map(d => parseFloat(d.curr_price));
//       const bedroomsValues = filteredData.map(d => parseInt(d.bedrooms));
//       const fullBathsValues = filteredData.map(d => parseInt(d.full_baths));
//       const halfBathsValues = filteredData.map(d => parseInt(d.half_baths));
//       const parkingValues = filteredData.map(d => parseInt(d.parking));
  
//       priceRange.min = Math.min(...priceValues);
//       priceRange.max = Math.max(...priceValues);
//       bedrooms.max = Math.max(...bedroomsValues);
//       fullBaths.max = Math.max(...fullBathsValues);
//       halfBaths.max = Math.max(...halfBathsValues);
//       parking.max = Math.max(...parkingValues);
  
//       // Display filter values
//       document.getElementById('priceRangeValue').textContent = priceRange.value;
//       document.getElementById('bedroomsValue').textContent = bedrooms.value;
//       document.getElementById('fullBathsValue').textContent = fullBaths.value;
//       document.getElementById('halfBathsValue').textContent = halfBaths.value;
//       document.getElementById('parkingValue').textContent = parking.value;
  
//       // Update displayed values on input change
//       priceRange.oninput = () => document.getElementById('priceRangeValue').textContent = priceRange.value;
//       bedrooms.oninput = () => document.getElementById('bedroomsValue').textContent = bedrooms.value;
//       fullBaths.oninput = () => document.getElementById('fullBathsValue').textContent = fullBaths.value;
//       halfBaths.oninput = () => document.getElementById('halfBathsValue').textContent = halfBaths.value;
//       parking.oninput = () => document.getElementById('parkingValue').textContent = parking.value;
//     }
//   });
  
//   document.addEventListener('DOMContentLoaded', function() {
//     var rangeMin = document.getElementById('rangeMin');
//     var rangeMax = document.getElementById('rangeMax');
//     var minValueInput = document.getElementById('minValue');
//     var maxValueInput = document.getElementById('maxValue');

//     function updateValues() {
//         minValueInput.value = rangeMin.value;
//         maxValueInput.value = rangeMax.value;
//     }

//     rangeMin.addEventListener('input', function() {
//         if (parseInt(rangeMin.value) >= parseInt(rangeMax.value)) {
//             rangeMin.value = parseInt(rangeMax.value) - 1;
//         }
//         updateValues();
//     });

//     rangeMax.addEventListener('input', function() {
//         if (parseInt(rangeMax.value) <= parseInt(rangeMin.value)) {
//             rangeMax.value = parseInt(rangeMin.value) + 1;
//         }
//         updateValues();
//     });

//     minValueInput.addEventListener('input', function() {
//         if (parseInt(minValueInput.value) < parseInt(rangeMax.value) && parseInt(minValueInput.value) >= rangeMin.min) {
//             rangeMin.value = minValueInput.value;
//         } else {
//             minValueInput.value = rangeMin.value;
//         }
//     });

//     maxValueInput.addEventListener('input', function() {
//         if (parseInt(maxValueInput.value) > parseInt(rangeMin.value) && parseInt(maxValueInput.value) <= rangeMax.max) {
//             rangeMax.value = maxValueInput.value;
//         } else {
//             maxValueInput.value = rangeMax.value;
//         }
//     });

//     updateValues(); // Initial call to set values correctly
// });



  // Sidebar toggle
  document.getElementById('sidebarToggle').onclick = function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    sidebar.classList.toggle('collapsed');
    sidebarToggle.querySelector('img').src = sidebar.classList.contains('collapsed') 
      ? 'assets/arrow-square-right.svg' 
      : 'assets/arrow-square-left.svg';
    setTimeout(() => map.invalidateSize(), 300);  // Adjust map size after animation
  };