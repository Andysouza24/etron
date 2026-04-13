import os
import shutil
import subprocess
import glob

# === CONFIGURATION ===
TARGET_FOLDERS = [
    "user/functions/user-core",
    "user/functions/user-invites",
    "workspace/functions/workspace-core",
    "workspace/functions/workspace-remover",
    "workspace/functions/workspace-invites",
    "workspace/functions/workspace-modules",
    "workspace/functions/workspace-boards",
    "workspace/functions/workspace-roles",
    "workspace/functions/workspace-users",
    "modules/day-book/data-sources",
    "modules/day-book/metrics/functions/metric-core",
    "modules/day-book/metrics/functions/metric-updater",
    "modules/day-book/reports/functions/reports-drafts",
    "modules/day-book/reports/functions/reports-exports",
    "modules/day-book/reports/functions/reports-templates",
    "modules/day-book/data-sources/functions/data-source-core",
    "modules/day-book/data-sources/functions/polling/data-source-poller",
    "modules/day-book/data-sources/functions/polling/data-source-poller-initialiser",
    "modules/day-book/data-sources/functions/data-source-upload-processor",
    "modules/day-book/data-sources/functions/data-update-notifier",
    "audit/functions/audit-core",
    "audit/functions/archive-audit-logs",
    "audit/functions/audit-processor",
    "notification/functions/notification-core",
    "notification/functions/notification-evaluator",
]

SHARED_FOLDERS = [
    "shared",
    "modules/day-book/reports/reports-shared",
    "modules/day-book/data-sources/data-sources-shared",
    "modules/day-book/metrics/metrics-shared",
    "modules/day-book/day-book-shared"
]

# === FUNCTIONS ===
def get_project_root():
    """Auto-detect project root assuming this script is inside the project."""
    return os.path.dirname(os.path.abspath(__file__))

def clean_and_install(folder_path):
    """Remove node_modules and package-lock.json, then run npm install."""
    print(f"\n=== Processing: {folder_path} ===")
    
    node_modules_path = os.path.join(folder_path, "node_modules")
    if os.path.exists(node_modules_path):
        print(f"🗑 Removing {node_modules_path} ...")
        shutil.rmtree(node_modules_path)
    else:
        print("ℹ No node_modules found.")
    
    package_lock_path = os.path.join(folder_path, "package-lock.json")
    if os.path.exists(package_lock_path):
        print(f"🗑 Removing {package_lock_path} ...")
        os.remove(package_lock_path)
    else:
        print("ℹ No package-lock.json found.")
    
    print("📦 Running npm install...")
    subprocess.run(["npm", "install"], cwd=folder_path, shell=True)

def pack_folder(folder_path):
    """Remove existing tgz files and run npm pack."""
    if not os.path.exists(folder_path):
        print(f"❌ Shared folder not found: {folder_path}")
        return

    print(f"=== Processing shared tgz in: {folder_path} ===")
    
    tgz_files = glob.glob(os.path.join(folder_path, "*.tgz"))
    for tgz in tgz_files:
        print(f"🗑 Removing {tgz} ...")
        os.remove(tgz)

    print("📦 Running npm pack...")
    subprocess.run(["npm", "pack"], cwd=folder_path, shell=True)

# === MAIN SCRIPT ===
def main():
    project_root = get_project_root()
    print(f"Detected project root: {project_root}")

    # Process shared folders first
    for shared_folder in SHARED_FOLDERS:
        shared_path = os.path.join(project_root, shared_folder)
        pack_folder(shared_path)

    # Process target folders
    for folder in TARGET_FOLDERS:
        folder_path = os.path.join(project_root, folder)
        if not os.path.exists(folder_path):
            print(f"❌ Skipping {folder} (does not exist)")
            continue
        clean_and_install(folder_path)

    print("\n✅ All done!")

if __name__ == "__main__":
    main()
