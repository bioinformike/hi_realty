// // Function to fetch and read the TSV file content

// export function loadHomeData(callback) {
//     Papa.parse('./assets/latest_home_data.tsv', {
//       download: true,
//       header: true,
//       complete: function(results) {
//         callback(results.data);
//         console.log("Finished processing data in loadHomeData function");
//       }
//     });
//   }



// export function parseData(data) {
//     let min_price = 0;
//     let max_price = 0;
//     data.forEach(property => {
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
//         min_price = price;
//         } else if (price > max_price) {
//         max_price = price;
//     }
// }



// // Function to calculate minimum and maximum for a column
// export function min(df, column) {
//     const values = df[column].map(value => parseFloat(value));
//     const minValue = Math.min(...values);
//     return minValue ;
// }

// export function max(df, column) {
//     const values = df[column].map(value => parseFloat(value));
//     const maxValue = Math.max(...values);
//     return maxValue ;
// }