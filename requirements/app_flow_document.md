# App Flow Document

## Onboarding and Sign-In/Sign-Up

When a user opens the application via its URL, they are taken directly to the main interface without any requirement for creating an account or signing in. There is no sign-up form, social login, or password recovery screen, because the system is designed for a single operator. As soon as the page loads, the user is ready to begin by selecting a store and uploading CSV files. No sign-out button or account settings are present because authentication is not part of this version.

## Main Dashboard or Home Page

Upon loading, the user sees a clean header displaying the application name and a central area labeled Store Selection. Below the header, a dropdown menu lists predefined store configurations, each corresponding to a set of four CSV files. The main view also reserves space for the CSV upload section and subsequent configuration panels. There are no sidebars or user profile menus since the focus is on the store boxes and the CSV-driven workflow. The navigation path flows from top to bottom: first choose a store, then upload CSVs, then configure prompts and generate reviews.

## Detailed Feature Flows and Page Transitions

### Store Selection Flow

When the user clicks on the store dropdown, a list of store names appears. Selecting a name highlights that store box and loads any previously stored metadata for the four CSV files associated with that store. The page scrolls smoothly down to reveal the CSV upload area. If the user switches to a different store, the previously visible CSV fields and upload previews are replaced with the new store’s saved information or with empty fields if no files were uploaded yet.

### CSV Upload and Validation Flow

Once a store is chosen, the CSV upload area becomes active. The user drags and drops the four required files—keywords.csv, patterns.csv, examples.csv, and quality_rules.csv—into separate drop zones. As each file lands, the application parses it instantly and displays a tabular preview of its content. The system performs schema checks in the background. If a file fails validation, a raw error message appears immediately below its preview, explaining the exact schema mismatch or missing column. The user corrects the CSV and re-uploads until all four are validated successfully. After the last file passes, the upload section collapses and the prompt configuration panel expands.

### Prompt Configuration Flow

With all CSV files validated, the user sees a dynamically generated prompt in a large editable text field. This prompt is built from the CSV content and can be fine-tuned by the user. Directly beneath this field is a slider set to a default of ten reviews, allowing the user to choose any number from one to one hundred. As the slider moves, the numeric value updates in real time. When the prompt and count are ready, a prominent Generate button becomes enabled. Clicking outside the panel does not navigate away; it simply allows adjusting the prompt until generation begins.

### Generation Execution and Progress Flow

After the user clicks Generate, the UI dims the prompt area and displays a horizontal progress bar at the top of the generation results section. Reviews stream in one by one in a scrollable list. Each review entry shows the review text and its computed naturalness score next to it. The progress bar advances in real time, indicating how many reviews have been returned versus the target count. Requests are handled in the order they arrive, and if multiple requests are triggered accidentally, they queue up and each shows its own progress state in the same list.

### Quality Verification and Regeneration Flow

When the target number of reviews is reached, the system’s quality controller agent filters out any review that fails to meet the minimum score or violates prohibited expressions from quality_rules.csv. Those entries disappear from the list, and the progress bar updates to reflect the filtered total. Next to each surviving review, a small Regenerate icon appears. Clicking it sends a new generation request for that single demographic slot, preserving the same age and gender distribution rules. The list updates in place as the replacement review arrives.

### Exporting Results Flow

Once the user is satisfied with the filtered list, they click the Download CSV button positioned below the results list. That action triggers a file download containing all final review records with columns for review text, age group, gender, companion, word type, recommended context, and quality score. The download occurs without leaving the page. After downloading, the user can immediately adjust the prompt, change the review count, or switch to another store configuration to begin a new batch.

### Switching Store Flow

At any point the user can scroll back to the top and open the store dropdown. Selecting a different store clears the current upload section and results area and loads the metadata or blank fields for the new store. The prompt and slider reset to defaults, and the user repeats the upload, validation, and generation steps for the new store’s CSV files.

## Settings and Account Management

Since this application does not use individual user accounts or roles, there is no traditional account management or personal information panel. The only configurable settings are the prompt text and the batch size slider within the prompt configuration panel. The user returns to the main workflow by completing prompt tweaks and clicking Generate. There is no global settings menu or billing interface in this release.

## Error States and Alternate Paths

If a CSV file fails schema validation, the raw error message appears directly under its preview pane. The user cannot proceed to prompt configuration until all validation errors are resolved. During generation, if the AI API returns an error or network connectivity is lost, an overlay displays the exact error message and a Retry button. Clicking Retry attempts to send the current prompt and demographic distribution again. If progress stalls or a queued request times out, the user sees a message explaining the failure and can choose to restart the entire generation or adjust the prompt before trying again.

## Conclusion and Overall App Journey

From opening the URL to downloading a set of polished, natural Japanese reviews, the user experience is linear and immediate. The user begins by selecting a store, then uploads and validates four CSV files, fine-tunes the generated prompt, and chooses a review count. Generation streams back individual reviews with scores, low-quality entries are filtered out automatically, and any unsatisfactory review can be regenerated in place. A final CSV download completes the cycle. At no point does the user leave the page or manage accounts, ensuring that the entire journey remains focused on turning CSV inputs into high-quality reviews as quickly and transparently as possible.