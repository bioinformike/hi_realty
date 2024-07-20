# Load our libraries we will need
# Dealing with web stuff
import requests as req
from bs4 import BeautifulSoup as bs4
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

# Get latitude and Longitude of properties
from geopy.geocoders import GoogleV3
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# Misc libraries
import os
import re
import tqdm
import pandas as pd
from datetime import datetime
import shutil

# Do we want debug messages to print or not
DEBUG = False

# Setup some constants
# Directory of Project
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

# Get our .env file from out locker
env_path = os.path.join(PROJECT_DIR, 'scraping' , 'locker', '.env')
env_path = os.path.abspath(env_path)

# Read in our Google Maps API key
with open(env_path, 'r') as env_file:
    lines = env_file.readlines()
    raw_api = lines[0]

GMAP_API_KEY = raw_api.split('=')[1].replace("'", "").strip()

# All results URL
BASE_URL = 'https://propertysearch.hicentral.com'

# Direct property URL
DIRECT_URL = f'{BASE_URL}/HBR/ForRent/?/'

# HI Central has a very weird URL style, from what I've been able to decipher 
# for every filter there is a section in the URL, no matter if that filter is
# applied, in which case there will be nothing beteween the "start" and "end"
# slashes, e.g. '//', or if a filter is applied then a number will appear
# between the slashes, e.g., '/295/'. So this leads to some really wonky URLs
# for scraping as can be seen below.

all_res_url = f'{BASE_URL}/HBR/ForRent/?/Results/Neighborhood///295//128////////1////////////////////////////'


START_URL = f'{BASE_URL}/HBR/ForRent/?/Results/Neighborhood//'
MID_URL = f'/295//128////////'
END_URL = '////////////////////////'
SHORT_END_URL = '////////////////////////'


# Define some helper functions

# Generate a datetime stamp for output filenames
def get_dt():
  now = datetime.now().astimezone()
  dt_string = now.strftime('%Y-%m-%d_%H-%M-%S_%Z')
  dt_string = dt_string.replace('Eastern Daylight Time', 'EDT')
  dt_string = dt_string.replace('Eastern Standard Time', 'EST')
  return dt_string

# Function to clean a single string
def clean_string(s):
  # Remove weird characters
  pattern = r'[^a-zA-Z0-9 #,-]'
  
  return re.sub(pattern, '', s)

# Function to replace multiple # with a single # - Weird things were happening
def squeeze_hashes(s):
  # Matches one or more consecutive #
  pattern = r'#+'  
  return re.sub(pattern, '#', s)

# Just see if it starts with numbers like an address (123 Brighton street | Not Honolulu, HI 94666)
def is_full_add(add_text):
  ADD_REGEX = r'^\d'
  return re.search(ADD_REGEX, add_text) is not None

# Break address up into component pieces
def break_address(input_str):
  UNIT_REGEX = r'#\S+'

  # Parts of address
  loc_name = '-'
  street_add = '-'
  rest = '-'
  unit_num = '-'
  city = '-'
  state = '-'
  zip_code = '-'

  if input_str == 'Address unavailable':
    return  loc_name, street_add, rest, unit_num, city, state, zip_code 

  add_parts = input_str.split('\n')

  for curr_part in add_parts:
    # Check if the part contains any digits
    if any(char.isdigit() for char in curr_part):
      
      # If it contains digits, it's the address or rest of address with zip code
      if is_full_add(curr_part):
        street_add = curr_part
      else:
        rest = curr_part
    else:
      # If it doesn't contain digits, it's likely the location name
      loc_name = curr_part

  if street_add != '-':
    if '#' in street_add:
      # We have an apartment number, so parse and set it
      hash_idx = street_add.find('#')
      unit_num = f'#{street_add[hash_idx:]}'

  if rest != '-':
    city, state_zip = rest.strip().split(',')
    state, zip_code = state_zip.strip().split(' ')

  if DEBUG:
    print(input_str)
    print(f"\tloc_name   =  {loc_name}")
    print(f"\tstreet_add =  {street_add}")
    print(f"\tunit_num   =  {unit_num}")
    print(f"\tcity       =  {city}")
    print(f"\tstate      =  {state}")
    print(f"\tzip_code   =  {zip_code}")
    print("============================================================")

  return  loc_name, street_add, rest, unit_num, city, state, zip_code 

# Function to use Google to get lat and lon for address
def get_coords(input_address, input_api_key):
  try:
    geolocator = GoogleV3(api_key = input_api_key)
    location = geolocator.geocode(input_address)
    
    if location:
      return (location.latitude, location.longitude)
    else:
      return None
  except (GeocoderTimedOut, GeocoderServiceError) as e:
    print(f"Error: {e}")
    return None
  
# Function to generate a URL given some particular parameters (only used when more results)
# than can be loaded in the X max pages it allows you to load
def gen_url(page_num = '', option_id = '', min_dollar = '', max_dollar = ''):
  return f'{START_URL}{page_num}{MID_URL}1/{option_id}///{min_dollar}/{max_dollar}/{SHORT_END_URL}'

# Scrape a single page given a URL
def get_page(input_url, input_region):

  page = req.get(input_url)
  soup = bs4(page.content, "html.parser")

  curr_ids = [anchor.text for anchor in soup.find_all('a', string=re.compile(r'^\d+$'))]

  # Capture when there are additional pages of results
  page_num_ls = list(set([x for x in curr_ids if x.isdigit() and 1 <= int(x) <= 10]))
  n_pages = len(page_num_ls)

  # Grab the IDs without the page numbers
  curr_ids = list(set([x for x in curr_ids if x.isdigit() and 1 <= int(x) > 10]))
  curr_id_ls = list(zip([input_region] * len(curr_ids), curr_ids))
  curr_id_ls = [list(t) for t in curr_id_ls]
  
  
  return [curr_id_ls, page_num_ls, n_pages]

# Extract all the data for a given property ID
def get_id_page_w_api(input_id):

  curr_url = f'{BASE_URL}/HBR/ForRent/?/{input_id}'
  
  # Define the number of maximum retries
  max_retries = 7
  
  # Create a Session object
  session = req.Session()

  # Setup retry strat
  retry_strategy = Retry(total = 5, backoff_factor = 10)

  # Create a HTTPAdapter with the specified max retries
  adapter = HTTPAdapter(max_retries = retry_strategy)
  
  # Mount the adapter to the session
  session.mount('http://', adapter)
  session.mount('https://', adapter)
  
  page = session.get(curr_url)
  soup = bs4(page.content, "html.parser")
  
  # Check if listing was not found
  header = soup.find('h2', class_ = 'hdr-sub')
  
  content_div = soup.find('div', id = 'content')
  soup.contents = content_div.contents
  
  # Get address text
  add_text = soup.h2.get_text(separator="\n")
  
  # Break address into parts 
  loc_name, street_add, rest, unit_num, city, state, zip_code  = break_address(add_text)

  # Check the address assuming it's bad
  GOOD_ADD = False
  if ((street_add != '-') and (city != '-') and (state != '-') and (zip_code != '-')):
      clean_full_add = f'{street_add}, {city}, {state} {zip_code}'
      GOOD_ADD = True
  else:
      clean_full_add = '-'
  
  # Assuming we have a good address use Google to grab the lat and lon for this address
  if GOOD_ADD:
      lat, lon = get_coords(clean_full_add, GMAP_API_KEY)
  else:
      lat = '-'
      lon = '-'
  
  # Now extract a bunch of other information about the property
  sub = soup.find('div', class_ = 'sub-heading')

  # Property post activity status
  active_status = sub.find('div', class_ = 'active-box')
  active_status_str = active_status.text

  # Price, rental type, and available date
  price_boxes = sub.find_all('div', class_ = 'price-box')
  for curr_box in price_boxes:

    curr_label = curr_box.find('span').text
    
    if curr_label == 'Price':
        curr_price = curr_box.find('div').text

    elif curr_label == 'Rental Type':
        curr_type = curr_box.find('div').text

    elif curr_label == 'Available Date':
        curr_date = curr_box.find('div').text

    bedrooms = soup.find('dt', string = 'Bedrooms: ').find_next_sibling('dd').text
    full_baths = soup.find('dt', string = 'Full Baths: ').find_next_sibling('dd').text
    half_baths = soup.find('dt', string = 'Half Baths: ').find_next_sibling('dd').text
    parking = soup.find('dt', string = 'Parking Stalls: ').find_next_sibling('dd').text

    land_area  = soup.find('dt', string = 'Land Area (sf): ').find_next_sibling('dd').text
    live_area  = soup.find('dt', string = 'Living (sf): ').find_next_sibling('dd').text
    lanai_area = soup.find('dt', string = 'Lanai (sf): ').find_next_sibling('dd').text
    other_area = soup.find('dt', string = 'Other (sf): ').find_next_sibling('dd').text

    island = soup.find('dt', string = 'Island:').find_next_sibling('dd').text.title()
    region = soup.find('dt', string = 'Region:').find_next_sibling('dd').text.title()
    hood = soup.find('dt', string = 'Neighborhood:').find_next_sibling('dd').text.title()

    pets_allowed =  soup.find('dt', string = 'Pets Allowed?').find_next_sibling('dd').text
    res_man =  soup.find('dt', string = 'Resident Manager?').find_next_sibling('dd').text

    deposit =  soup.find('dt', string = 'Deposit Amount:').find_next_sibling('dd').text
    term =  soup.find('dt', string = 'Terms Accepted:').find_next_sibling('dd').text

    description = soup.find('h3', string = 'REMARKS:').find_next_sibling('p').text

    unit_features =  soup.find('dt', string = 'Unit Features:').find_next_sibling('dd').text
    parking_features =  soup.find('dt', string = 'Parking Features:').find_next_sibling('dd').text
    frontage = soup.find('dt', string = 'Frontage:').find_next_sibling('dd').text
    view = soup.find('dt', string = 'View:').find_next_sibling('dd').text
    furnished = soup.find('dt', string = 'Furnished: ').find_next_sibling('dd').text
    amenities = soup.find('dt', string = 'Amenities:').find_next_sibling('dd').text
    pool = soup.find('dt', string = 'Pool:').find_next_sibling('dd').text
    inclusions = soup.find('dt', string = 'Inclusions:').find_next_sibling('dd').text
    build_style = soup.find('dt', string = 'Building Style:').find_next_sibling('dd').text
    disclosures = soup.find('dt', string = 'Disclosures:').find_next_sibling('dd').text

    # Grab the URLs (AWS usually) for the images of the property
    img_urls = []
    for img in soup.find_all('img', {'u': 'image'}):
        img_urls.append(f"https:{img['src']}")

  return [input_id, clean_full_add, GOOD_ADD, lat, lon, loc_name, 
                street_add, unit_num, city, state, zip_code, active_status_str, curr_price, curr_type, curr_date,
                bedrooms, full_baths, half_baths, parking, 
                land_area, live_area, lanai_area, other_area,
                island, region, hood, pets_allowed, res_man, deposit, term, description,
                unit_features, parking_features, frontage, view, furnished, amenities, pool, inclusions, 
                build_style, disclosures, img_urls, curr_url]


# Our main function that does all the parsing
def main():
    
  # Get datetime
  curr_dt = get_dt()

  # Output directory
  OUT_DIR = os.path.join(PROJECT_DIR, 'scraping', 'results')
  OUT_DIR = os.path.abspath(OUT_DIR)


  RAW_FN   = f'{OUT_DIR}/hi_central_data_{curr_dt}.tsv'
  CLEAN_FN = f'{OUT_DIR}/hi_central_data_clean_{curr_dt}.tsv'
  FAIL_FN  = f'{OUT_DIR}/hi_central_failed_prop_id_list_{curr_dt}.tsv'
  WEB_DEST = os.path.join(PROJECT_DIR, 'web', 'assets', 'latest_home_data.tsv')
  WEB_DEST = os.path.abspath(WEB_DEST)

  # It will max give me 10 pages of Apartments, so max of 200, so I'm going to need to 
  # do some limitations 

  # The regions defined on their site
  region_dict = {
                      "1": "All Regions",
                      "2": "Diamond Head",
                      "3": "Ewa Plain",
                      "4": "Hawaii Kai",
                      "5": "Kailua",
                      "6": "Kaneohe",
                      "7": "Leeward Coast",
                      "8": "Makakilo",
                      "9": "Metro Oahu",
                      "10": "North Shore",
                      "11": "Pearl City/Aiea",
                      "12": "Waipahu"
  }

  print(f'\n\nStaring new collection of property IDs across {len(region_dict.keys())}')


  # If we get back over 200 results, we will play this game of slowly checking specific price ranges
  # so we can in the end get all results for that region
  DOLLAR_SEARCH_LS = [['', 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], 
                      [6, 7], [7, 8], [8, 9], [9, 10], [10, '']]

  # Keeps track of region name and property ID so we can look up all the details later
  fin_id_ls = []

  # A list to keep track of summary information, specifically for each region how many pages we processed
  # and how many property IDs we pulled from all those pages
  # ['Diamond Head', 2, 50],
  # ['Ewa Plain', 4, 89],
  # ['Hawaii Kai', 1, 22],
  # ['Kailua', 1, 35],
  # ['Kaneohe', 1, 40],
  # ...
  reg_sum_ls = []

  # Go through region by region
  for option_id, region in tqdm.tqdm(region_dict.items()):
        
    region_id_ls = []
        
    if DEBUG:
        print(f'{option_id} -> {region}')
        
    # Skip the all regions option since we can't get all results
    if region == 'All Regions':
        continue
        
    # Generate our URL for this region
    curr_url = gen_url(option_id = option_id)

    # Get the ID list, page number list, and total number of pages for this region with no additional
    # search criterion besides region.
    curr_id_ls, page_num_ls, n_pages = get_page(curr_url, region)

    # Keep count of the number of IDs we have for this region
    n_ids = len(curr_id_ls)

    # Also keep a list of region IDs we have been through
    region_id_ls.append(curr_id_ls)
    
    # Debug statements for printing info out when something goes wrong
    if DEBUG:
      print(f'\tURL:\t{curr_url}\n\tIDs:\t{n_ids}\n\tPages:\t{n_pages}')
        
        
    # If we have more pages to look at grab the IDs for all those properties too
    if len(page_num_ls) > 0:
      
      for curr_page in page_num_ls:

        # Generate the url for this current page
        curr_url = gen_url(page_num = curr_page, option_id = option_id)

        # Get the list of IDs, etc.
        curr_id_ls, page_num_ls, n_pages = get_page(curr_url, region)

        # Update the number of IDs given this new page of results
        n_ids = n_ids + len(curr_id_ls)
        region_id_ls.append(curr_id_ls)

        if DEBUG:
          print(f'More than 1 page:\n\tURL:\t{curr_url}\n\tIDs:\t{n_ids}\n\tPages:\t{n_pages}')
      
    # Metro oahu also has more than 200 properties, so we need to figure out a way
    # to break that up 
    # We can walk different searches
    if n_ids == 200:
      # Example of what Page URL looks like including not just region but also min and max dollar
      #PAGE_URL = f'{START_URL}{PAGE_NUM}{MID_URL}1/{option_id}///{MIN_DOLLAR}/MAX_DOLLAR/{SHORT_END_URL}'

      # Go through that dollar search list we made before doing essentially what we have been doing, but adding
      # prices to the gen_url arguments
      for MIN_DOLLAR, MAX_DOLLAR in DOLLAR_SEARCH_LS:
        # Reset page number
        curr_url = gen_url(option_id = option_id, min_dollar = MIN_DOLLAR, max_dollar = MAX_DOLLAR)

        curr_id_ls, page_num_ls, n_pages = get_page(curr_url, region)

        n_ids = len(curr_id_ls)
        region_id_ls.append(curr_id_ls)
        
        if DEBUG:
            print(f'More than 200 IDs:\n\tURL:\t{curr_url}\n\tMin Dollar:\t{MIN_DOLLAR}\n\tMax Dollar:\t{MAX_DOLLAR}\n\tIDs:\t{n_ids}\n\tPages:\t{n_pages}')

        # If we have more pages to look at grab those too
        if len(page_num_ls) > 0:
          
          # Similar to above if we are going through price searches we need to be prepared that there might be more than 1 page 
          # for a set min and max price and we need to process that appropriately
          for curr_page in page_num_ls:
            curr_url = gen_url(page_num = curr_page, option_id = option_id,
                                min_dollar = MIN_DOLLAR, max_dollar = MAX_DOLLAR)

            curr_id_ls, page_num_ls, n_pages = get_page(curr_url, region)

            n_ids = n_ids + len(curr_id_ls)
            region_id_ls.append(curr_id_ls)

          if DEBUG:
            print(f'More than 200 IDs and more than 1 page:\n\tURL:\t{curr_url}\n\tMin Dollar:\t{MIN_DOLLAR}\n\tMax Dollar:\t{MAX_DOLLAR}\n\tIDs:\t{n_ids}\n\tPages:\t{n_pages}')
  
    reg_sum_ls.append([region, n_pages, n_ids])
    fin_id_ls.append(region_id_ls)
    
    if DEBUG:
      print("==============================================================")
          
  # ChatGPT's interesting way of un-nesting this mess
  unnested_list = [inner for outer in fin_id_ls for middle in outer for inner in middle]
  fin_id_ls = unnested_list

  fin = pd.DataFrame(fin_id_ls, columns = ['region', 'id'])

  # Drop any dupes that were collected
  fin = fin.drop_duplicates('id')

  # Now get information about each propery
  # Collect the actual home data
  fin_id_ls = fin['id'].unique().tolist()

  print(f'Finished collecting {len(fin_id_ls)} across {len(fin['region'].unique().tolist())} regions!')
  print(f'Moving onto collecting information about each property (ID)...')

  # Will log property information we were able to successfully get
  home_data_ls = []

  # Log property IDs we failed to get data for
  failed_ls = []

  # Loop through each property ID
  for curr_id in tqdm.tqdm(fin_id_ls):

    # Generate URL for exact property ID
    curr_url = f'{BASE_URL}/HBR/ForRent/?/{curr_id}'
    fail = True
    
    # Try to get that property's page and if we fail throw an exception
    try:
      curr_page_dat = get_id_page_w_api(curr_id)
      fail = False

    except Exception as e:
      if DEBUG:
        print(f'Failed on {curr_id}:\t{curr_url}\n\t\t{e}')   
      fail = True

    if fail:
      failed_ls.append(curr_id)
    else:        
      home_data_ls.append(curr_page_dat)
          

  # Finally make a dataframe for all properties we succeeded in grabbing data for
  home_data = pd.DataFrame(home_data_ls, 
                          columns = ['input_id', 'clean_full_add', 'is_good_addy', 'lat', 'lon',
                                    'loc_name', 'street_add', 'unit', 'city', 'state', 'zip_code', 
                                    'active_status_str', 'curr_price', 'curr_type', 'curr_date',
                                    'bedrooms', 'full_baths', 'half_baths', 'parking', 
                                    'land_area', 'live_area', 'lanai_area', 'other_area',
                                    'island', 'region', 'hood', 'pets_allowed', 'res_man', 'deposit', 'term', 'description',
                                    'unit_features', 'parking_features', 'frontage', 'view', 'furnished', 
                                    'amenities', 'pool', 'inclusions', 
                                    'build_style', 'disclosures', 'img_urls', 'orig_url'])


  # Little bit of clean up
  home_data['clean_full_add'] = home_data['clean_full_add'].apply(clean_string)
  home_data['street_add'] = home_data['street_add'].apply(clean_string)
  home_data['unit'] = home_data['unit'].apply(squeeze_hashes)


  # Remove any records without good address or lat/long
  clean = home_data.copy(deep = True)
  clean = clean.loc[~((clean['is_good_addy'] == False) | 
                    (clean['lat'] == '-') | 
                    (clean['lat'] == '-')), ]


  print(f'Finished collecting all property information, saving results...')

  # Save the output of this run - including a raw version, a cleaned version and the list of failed property IDs for
  # future trouble shooting


  home_data.to_csv(RAW_FN, sep = '\t', index = False)
  clean.to_csv(CLEAN_FN, sep = '\t', index = False)

  with open(FAIL_FN, 'w') as f:
    for curr_fail in failed_ls:
      f.write(f"{curr_fail}\n")


  # Copy the latest version of clean data in web/assets/ for use with website
  try:
    shutil.copy2(CLEAN_FN, WEB_DEST)
    print(f"Copied {CLEAN_FN}\n\t->\t{WEB_DEST}.")

  except FileNotFoundError:
    print(f"Source file {CLEAN_FN} not found.")

  except PermissionError:
    print(f"Permission denied while copying to:\n\t{WEB_DEST}.")

  except Exception as e:
    print(f"An error occurred: {e}")


  print(f'All done!')


if __name__ == "__main__":
  main()

