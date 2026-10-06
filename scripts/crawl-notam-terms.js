import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const urls = [
  'https://proairpilot.com/notam-abbreviations.html',
  'https://proairpilot.com/notam-acronyms.html',
  'https://proairpilot.com/faa-notam.html',
  'https://proairpilot.com/faa-notams.html'
];

const existingTerms = new Set();

async function loadExistingTerms() {
  const dictPath = path.join(process.cwd(), 'src', 'dict', 'dictionary.ts');
  const content = fs.readFileSync(dictPath, 'utf8');
  const termMatches = content.match(/"term": "([^"]+)"/g);
  if (termMatches) {
    termMatches.forEach(match => {
      const term = match.match(/"term": "([^"]+)"/)[1];
      existingTerms.add(term.trim().toUpperCase());
    });
  }
  console.log(`Existing terms loaded: ${existingTerms.size}`);
}

async function crawlPage(url) {
  try {
    console.log(`Crawling ${url}...`);
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    const terms = [];

    // Try to find tables containing terms and definitions
    $('table').each((tableIndex, table) => {
      $(table).find('tr').each((rowIndex, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const term = $(cells[0]).text().trim();
          const definition = $(cells[1]).text().trim();

          if (term && definition && term.length <= 20 && definition.length <= 300) {
            const cleanTerm = term.toUpperCase().replace(/\s+/g, ' ').trim();
            const cleanDef = definition.replace(/\s+/g, ' ').trim();
            
            if (!existingTerms.has(cleanTerm)) {
              terms.push({
                term: cleanTerm,
                description: cleanDef,
                category: 'NOTAM'
              });
              existingTerms.add(cleanTerm);
              console.log(`Found: ${cleanTerm}`);
            }
          }
        }
      });
    });

    // Also try to find definition lists
    $('.definition-list, dl').each((dlIndex, dl) => {
      $(dl).find('dt').each((dtIndex, dt) => {
        const term = $(dt).text().trim();
        const dd = $(dt).next('dd');
        const definition = dd.text().trim();

        if (term && definition && term.length <= 20 && definition.length <= 300) {
          const cleanTerm = term.toUpperCase().replace(/\s+/g, ' ').trim();
          const cleanDef = definition.replace(/\s+/g, ' ').trim();
          
          if (!existingTerms.has(cleanTerm)) {
            terms.push({
              term: cleanTerm,
              description: cleanDef,
              category: 'NOTAM'
            });
            existingTerms.add(cleanTerm);
            console.log(`Found: ${cleanTerm}`);
          }
        }
      });
    });

    console.log(`Found ${terms.length} new terms on ${url}`);
    return terms;
  } catch (error) {
    console.error(`Failed to crawl ${url}:`, error.message);
    return [];
  }
}

async function main() {
  try {
    await loadExistingTerms();

    const allNewTerms = [];
    for (const url of urls) {
      const terms = await crawlPage(url);
      allNewTerms.push(...terms);
    }

    console.log(`\nTotal new terms found: ${allNewTerms.length}`);

    if (allNewTerms.length > 0) {
      const dictPath = path.join(process.cwd(), 'src', 'dict', 'dictionary.ts');
      let content = fs.readFileSync(dictPath, 'utf8');

      // Find the end of the ALL_AVIATION_TERMS array (before the closing ];)
      const endMatch = content.match(/(\];)/);
      if (endMatch) {
        const insertionPoint = endMatch.index;
        const termsJson = JSON.stringify(allNewTerms, null, 2);
        
        // Remove the closing ] from the JSON to append properly
        const termsString = termsJson.slice(1, -1);
        
        // Insert new terms before the closing ];
        content = content.slice(0, insertionPoint) + ',\n' + termsString + '\n' + content.slice(insertionPoint);
        
        fs.writeFileSync(dictPath, content, 'utf8');
        console.log(`Successfully added ${allNewTerms.length} NOTAM terms to dictionary.ts`);
      } else {
        console.error('Could not find the end of ALL_AVIATION_TERMS array');
      }
    } else {
      console.log('No new NOTAM terms found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();