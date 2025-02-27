# Hawaiian Realty
This repository contains a set of components to download the data published by the Honolulu Board of Realtors available on their site [HiCentral](hicentral.com) to make a more user-friendly site.

# Components

## Scraper (Python)
The scraper accesses hicentral.com and collects information about the posted properties. It saves all properties to a text-formatted file to be parsed by the code handling generating the map view.

## Map (Leaflet.js)
This should be a webpage with an interactive map allowing the user to zoom and pan as expected. There should also be a sidebar to enable filtering scraped properties on common dimensions important to users.

# Progress
- [X] Scraper code
  - [X]  Scrape and process data from hicentral.com
  - [X]  Add step to get latitude and longitude from address for future mapping
  - [X]  Convert final working notebook to a python script that can be run standalone with logging

- [X] Map web page
  - [X] Generate placeholder page
  - [X] Add sidebar for filters
  - [X] Make rest of page map view centered on Hawaii
  - [X] Load in latest scraping results form local file
  - [X] Add markers to map for properties
  - [X] Group markers if necessary
