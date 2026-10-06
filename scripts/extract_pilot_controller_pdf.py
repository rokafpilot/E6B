import pdfplumber
import sys
import os

PDF_PATH = '/Users/sunghyunkim/Documents/E6B/dict/pilot_controller_grossory.pdf'
OUTPUT_PATH = '/Users/sunghyunkim/Documents/E6B/dict/pilot_controller_grossory.txt'

def extract_pdf_text():
    if not os.path.exists(PDF_PATH):
        print("PDF file not found")
        return False

    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            print(f'Number of pages: {len(pdf.pages)}')
            text = ''
            
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    print(f'Extracting page {i+1}')
                    text += page_text + '\n'
            
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                f.write(text)
                
            print(f'Successfully extracted to {OUTPUT_PATH}')
            print(f'Total characters: {len(text)}')
            return True
            
    except Exception as e:
        print(f'Error extracting PDF: {e}')
        return False

if __name__ == "__main__":
    extract_pdf_text()