import json
import sys
import os
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.chrome.options import Options
import re 
from functools import reduce
from bs4 import BeautifulSoup
import time

BASE_URL = 'https://open.spotify.com'
INPUT_FILE = 'scraper/user_ids.txt'
OUTPUT_FILE = 'data/network.json'

def parse_id(id_string):
    """Parse Spotify ID from the full ID string"""
    return id_string.split(":")[2].split("-")[0]

def setup_driver():
    """Setup and return Chrome driver with appropriate options"""
    options = Options()
    options.add_argument("--log-level=1")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def read_user_ids_from_file(filename):
    """Read user IDs from a text file, one per line"""
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            user_ids = [line.strip() for line in file if line.strip()]
        return user_ids
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found")
        return []
    except Exception as e:
        print(f"Error reading file '{filename}': {e}")
        return []

def get_username(user_id, driver, timeout=20):
    """Get the display name/username from a user's profile page"""
    profile_url = f"{BASE_URL}/user/{user_id}"
    
    try:
        driver.get(profile_url)
        
        # Wait for the page to load
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Wait a bit more for dynamic content
        time.sleep(2)
        
        # Try to find the username/display name
        try:
            # Look for the main heading that contains the user's display name
            username_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".e-9921-text.encore-text-headline-large.encore-internal-color-text-base"))
            )
            username = username_element.text.strip()
            return username if username else user_id
        except:
            # Fallback: try other selectors
            selectors = [
                "h1[data-encore-id='text']",
                "h1",
                "[data-testid='entityTitle']",
                ".Type__TypeElement-sc-goli3j-0.bcTfIx"
            ]
            
            for selector in selectors:
                try:
                    element = driver.find_element(By.CSS_SELECTOR, selector)
                    if element.text.strip():
                        return element.text.strip()
                except:
                    continue
            
            return user_id  # Fallback to user_id if no display name found
            
    except Exception as e:
        print(f"Error getting username for {user_id}: {e}")
        return user_id

def scrape_followers(user_id, driver, timeout=20):
    """Scrape followers for a specific user"""
    followers_url = f"{BASE_URL}/user/{user_id}/followers"
    
    try:
        # Set page load timeout
        driver.set_page_load_timeout(timeout)
        
        # Navigate to the followers URL
        driver.get(followers_url)
        
        # Wait for the page to be fully loaded
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Additional wait to ensure dynamic content is loaded
        time.sleep(2)
        
        # Get the page source (HTML)
        html_content = driver.page_source
        soup = BeautifulSoup(html_content, 'html.parser')

        # Find all 'p' tags with id starting with 'card-title-spotify:user'
        matches = soup.find_all('p', id=lambda x: x and x.startswith('card-title-spotify:user'))

        # Extract the 'title' attribute values and IDs
        followers = []
        for tag in matches:
            if 'title' in tag.attrs:
                follower_data = {
                    "name": tag['title'],
                    "id": parse_id(tag['id'])
                }
                followers.append(follower_data)
        
        return followers
    
    except TimeoutException:
        print(f"Page load timed out after {timeout} seconds for user {user_id}")
        return []
    except Exception as e:
        print(f"Error scraping followers for {user_id}: {e}")
        return []

def scrape_following(user_id, driver, timeout=20):
    """Scrape following for a specific user"""
    following_url = f"{BASE_URL}/user/{user_id}/following"
    
    try:
        # Set page load timeout
        driver.set_page_load_timeout(timeout)
        
        # Navigate to the following URL
        driver.get(following_url)
        
        # Wait for the page to be fully loaded
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Additional wait to ensure dynamic content is loaded
        time.sleep(2)
        
        # Attempt to click on friends button
        try:
            friends_button = WebDriverWait(driver, 2).until(
                EC.element_to_be_clickable((By.XPATH, "//button[@data-encore-id='chip']//span[contains(text(), 'Friends')]/.."))
            )
            friends_button.click()
            print(f"  Clicked friends button for user {user_id}")
            time.sleep(0.5)  # Wait for content to load after clicking
        except Exception as e:
            print(f"  Could not find or click friends button for user {user_id}: {e}")
        
        # Get the page source (HTML)
        html_content = driver.page_source
        soup = BeautifulSoup(html_content, 'html.parser')

        # Find all 'p' tags with id starting with 'card-title-spotify:user'
        matches = soup.find_all('p', id=lambda x: x and x.startswith('card-title-spotify:user'))

        # Extract the 'title' attribute values and IDs
        following = []
        for tag in matches:
            if 'title' in tag.attrs:
                following_data = {
                    "name": tag['title'],
                    "id": parse_id(tag['id'])
                }
                following.append(following_data)
        
        return following
    
    except TimeoutException:
        print(f"Page load timed out after {timeout} seconds for user {user_id}")
        return []
    except Exception as e:
        print(f"Error scraping following for {user_id}: {e}")
        return []

def save_network_data(network_data, filename=OUTPUT_FILE):
    """Save network data to JSON file"""
    try:
        with open(filename, 'w', encoding='utf-8') as file:
            json.dump(network_data, file, indent=2, ensure_ascii=False)
        print(f"Network data saved to {filename}")
    except Exception as e:
        print(f"Error saving network data: {e}")

def load_existing_network_data(filename=OUTPUT_FILE):
    """Load existing network data if file exists"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as file:
                return json.load(file)
    except Exception as e:
        print(f"Error loading existing network data: {e}")
    return {"users": []}

def scrape_network(input_file, output_file=OUTPUT_FILE):
    """Main function to scrape network data for multiple users"""
    user_ids = read_user_ids_from_file(input_file)
    
    if not user_ids:
        print("No user IDs found to process")
        return
    
    print(f"Found {len(user_ids)} user IDs to process")
    
    # Load existing data or create new structure
    network_data = load_existing_network_data(output_file)
    if "users" not in network_data:
        network_data = {"users": []}
    
    # Keep track of already processed users
    processed_users = {user["user_id"] for user in network_data["users"]}
    
    driver = setup_driver()
    
    # Open Spotify homepage and wait for manual login
    print("Opening Spotify homepage...")
    driver.get(BASE_URL)
    print("Please log in to Spotify manually in the browser window.")
    print("You have 60 seconds to log in...")
    
    for remaining in range(60, 0, -1):
        print(f"Starting scraping in {remaining} seconds...", end='\r')
        time.sleep(1)
    print("\nStarting scraping process...")
    
    try:
        for i, user_id in enumerate(user_ids, 1):
            if user_id in processed_users:
                print(f"Skipping {user_id} (already processed)")
                continue
                
            print(f"Processing user {i}/{len(user_ids)}: {user_id}")
            
            # Get username from profile page
            username = get_username(user_id, driver)
            print(f"  Username: {username}")
            
            # Scrape followers
            followers = scrape_followers(user_id, driver)
            print(f"  Found {len(followers)} followers")
            
            # Scrape following
            following = scrape_following(user_id, driver)
            print(f"  Found {len(following)} following")
            
            # Add to network data
            user_data = {
                "user_id": user_id,
                "username": username,
                "followers": followers,
                "following": following,
                "follower_count": len(followers),
                "following_count": len(following)
            }
            
            network_data["users"].append(user_data)
            processed_users.add(user_id)
            
            # Save progress after each user
            save_network_data(network_data, output_file)
            
            # Small delay between requests to be respectful
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\nScraping interrupted by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        driver.quit()
        print("Browser closed")

def main():
    """Main entry point"""
    print(f"Input file: {INPUT_FILE}")
    print(f"Output file: {OUTPUT_FILE}")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file '{INPUT_FILE}' does not exist")
        print("Please create the input file with user IDs (one per line)")
        return
    
    scrape_network(INPUT_FILE, OUTPUT_FILE)

if __name__ == "__main__":
    main()
