# Hawaiian Realty
This repository contains a set of components to download the data published by the Honolulu Board of Realtors available on their site [HiCentral](hicentral.com) in order to make a more user-friendly site.

# Components

## Scraper (Python)
The scraper accesses hicentral.com and collects information about the posted properties. It saves all properties to a text formatted file to be parsed by the code handling generating the map view.

## Map (Unknown language)
This should be a webpage with an interactive map allowing the user to zoom and pan as expected. There should also be a sidebar to enable filtering scraped properties on common dimensions important to users.

# Progress
- [ ] Scraper code
 - [ ]  Scrape and process data from hicentral.com
 - [ ]  Add step to get latitude and longitude from address for future mapping
 - [ ]  Convert final working notebook to a python script that can be run standalone with logging

- [ ] Map web page
 - [ ] Generate placeholder page
 - [ ] Add sidebar for filters
 - [ ] Make rest of page map view centered on Hawaii
 - [ ] Load in latest scraping results form local file
 - [ ] Add markers to map for properties
 - [ ] Group markers if necessary
