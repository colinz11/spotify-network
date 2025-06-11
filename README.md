# Spotify Network Visualization

A interactive web application that visualizes Spotify user networks using D3.js, showing relationships between users and their cliques (strongly connected components).

To run, run  scraper/scraper.py. 

You need a list of spotify ids in a txt file stored at INPUT_FILE = 'scraper/user_ids.txt'. 

I recommend running once for a user and obtaining all of the spotify ids in a txt file.

After running, you need to login with your spotify account. Then let the scraper do it's job.

After the scraper creates the network.json, run process_graph.py to process the data.

https://spotify-network-omega.vercel.app/ 

![image](https://github.com/user-attachments/assets/620f9eba-8141-47ff-ad67-59b4750067aa)
