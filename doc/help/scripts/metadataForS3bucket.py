import os
import json
import boto3
import time

# --- CONFIGURATION ---
LOCAL_DOCS_PATH = "/Users/scs1ng/Sites/prsm/doc/help/doc_build/manual" #  rspress markdown folder
S3_BUCKET_NAME = "prsm-help-162252354798-eu-west-2-an"     # Your private bucket
BASE_WEB_URL = "https://prsm.uk/doc/help/doc_build/manual/" # Live site URL
KB_ID = "48IIKVEPJC" # Bedrock Knowledge Base ID
DS_ID = "1CCOHBXV47" # Bedrock Data Source ID
# ---------------------

def sync_to_bedrock_s3():
    s3_client = boto3.client('s3')
    count = 0

    print(f"Starting sync of {LOCAL_DOCS_PATH} to s3://{S3_BUCKET_NAME}...")

    for root, dirs, files in os.walk(LOCAL_DOCS_PATH):
        for file in files:
            # We only want to process and upload the Markdown files
            if file.endswith(".md"):
                local_file_path = os.path.join(root, file)
                
                # 1. Determine S3 Key (path in bucket)
                rel_path = os.path.relpath(local_file_path, LOCAL_DOCS_PATH)
                s3_md_key = rel_path.replace("\\", "/") # Ensure S3 slashes
                
                # 2. Determine Citation URL
                web_path = rel_path.replace(".md", ".html").replace("\\", "/")
                full_web_url = f"{BASE_WEB_URL.rstrip('/')}/{web_path}"

                # 3. Create Metadata JSON
                metadata = {
                    "metadataAttributes": {
                        "x-amz-bedrock-kb-source-uri": full_web_url
                    }
                }
                metadata_json = json.dumps(metadata, indent=4)
                s3_metadata_key = f"{s3_md_key}.metadata.json"

                # 4. Upload Markdown file
                s3_client.upload_file(local_file_path, S3_BUCKET_NAME, s3_md_key)
                
                # 5. Upload Metadata string directly to S3 (no need to save local file)
                s3_client.put_object(
                    Bucket=S3_BUCKET_NAME,
                    Key=s3_metadata_key,
                    Body=metadata_json,
                    ContentType='application/json'
                )

                print(f"Uploaded: {s3_md_key} -> {full_web_url}")
                count += 1

    print(f"\nDone! Uploaded {count} Markdown files and {count} metadata sidecars.")
    return count

import time

def trigger_bedrock_sync():
    client = boto3.client('bedrock-agent')
    response = client.start_ingestion_job(knowledgeBaseId=KB_ID, dataSourceId=DS_ID)
    job_id = response['ingestionJob']['ingestionJobId']

    print(f"🔄 Sync started (Job ID: {job_id}). Waiting for completion...")

    while True:
        # Check the status
        status_resp = client.get_ingestion_job(
            knowledgeBaseId=KB_ID, 
            dataSourceId=DS_ID, 
            ingestionJobId=job_id
        )
        status = status_resp['ingestionJob']['status']
        
        if status == 'COMPLETE':
            print("✅ Sync Finished Successfully!")
            break
        elif status in ['FAILED', 'STOPPED']:
            print(f"❌ Sync {status}. Check AWS console for details.")
            break
        
        print(f"⏳ Status: {status}... (waiting 5s)")
        time.sleep(5)

if __name__ == "__main__":
    success  = sync_to_bedrock_s3()
    if (success > 0):
        trigger_bedrock_sync()