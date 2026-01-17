# Save Modified Times for Obsidian

This plugin provides commands to save and restore last modified times (file mtime) for notes in your vault. You might find it useful if you want to edit the frontmatter, e.g. change the priority property for a task note or add some tags, without updating the note's last modified time.

## Commands

### Save current note's last modified time

Saves the current note's last modified time to the plugin's settings. Any existing saved time is overwritten.

### Restore current note's last modified time

Restores the current note's last modified time from the plugin's settings.

### Save current note's last modified time to property

Saves the current note's last modified time to the `savedModifiedTime` property in the note. The property is overwritten if it already exists.

### Restore current note's last modified time from property

Restores the current note's last modified time from the `savedModifiedTime` property in the note.

### Save all last modified times

Saves all notes' last modified times to the plugin's settings. Any existing saved times are overwritten.

### Restore last modified times

Restores all or some of the last modified times that have changed from the times saved in the plugin's settings. A popup is shown where you can select which notes to restore time for. You can also update the saved times for selected notes in this popup.

### Add current note to excluded paths

Adds the full path of the current note to the list of excluded path prefixes (see Settings section).

## Settings

The plugin's Settings tab has options for various save confirmation prompts.

You can also define excluded path prefixes. All notes matching any of these are excluded when saving all notes and using the Restore popup. The commands operating only on the current note still save/restore regardless of exclusions.

There are also settings for if and when to automatically update saved times. It can be done once a day at a set time and/or when the plugin loads.

## Usage

Install and enable the plugin and then run the provided commands from the command palette, or set up hotkeys for them.
