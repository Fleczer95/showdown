#!/bin/bash

# ShowDown Bundletool Wrapper
# A convenient wrapper for bundletool operations
#
# Bundletool Setup:
# This script requires bundletool-latest.jar to be in the project root.
# Download it from: https://github.com/google/bundletool/releases
# Or run: wget https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar -O bundletool-latest.jar
#
# Note: bundletool-latest.jar is gitignored and should not be committed.

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUNDLETOOL_JAR="$PROJECT_ROOT/bundletool-latest.jar"
AAB_FILE="$PROJECT_ROOT/android/app/build/outputs/bundle/release/app-release.aab"
APKS_FILE="$PROJECT_ROOT/android/app/build/outputs/bundle/release/app.apks"
PACKAGE_NAME="com.showdown.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Show usage
show_usage() {
    cat << EOF
${BLUE}ShowDown Bundletool Wrapper${NC}

Usage: ./bundletool.sh <command> [options]

${YELLOW}Commands:${NC}
  setup              Download and install bundletool JAR
  build              Build APKs from AAB (split APKs by default)
  build-universal    Build universal APK from AAB (single large APK)
  install            Install APKs to connected device
  install-universal  Install universal APK to connected device
  uninstall          Uninstall the app from connected device
  launch             Launch the app on connected device
  devices            List connected Android devices
  full               Build, install, and launch (complete workflow)
  clean              Remove generated APKs files
  help               Show this help message

${YELLOW}Options:${NC}
  --aab <path>       Path to AAB file (default: $AAB_FILE)
  --apks <path>      Path to APKs output file (default: $APKS_FILE)
  --no-local-testing Disable local testing mode

${YELLOW}Examples:${NC}
  ./bundletool.sh build
  ./bundletool.sh install
  ./bundletool.sh full
  ./bundletool.sh build --aab /path/to/custom.aab

${YELLOW}Note:${NC} This wrapper uses bundletool v1.18.3 for AAB/APK operations.

EOF
}

# Check if AAB file exists
check_aab_exists() {
    if [ ! -f "$AAB_FILE" ]; then
        print_error "AAB file not found: $AAB_FILE"
        print_info "Please run 'npm run aab' first to build the AAB"
        exit 1
    fi
}

# Check if bundletool jar exists, offer to download if missing
check_bundletool_exists() {
    if [ ! -f "$BUNDLETOOL_JAR" ]; then
        print_error "bundletool JAR not found: $BUNDLETOOL_JAR"
        echo ""
        print_info "Download bundletool:"
        echo "  wget https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar -O bundletool-latest.jar"
        echo ""
        print_info "Or run: npm run bundletool setup"
        exit 1
    fi
}

# Check if APKs file exists
check_apks_exists() {
    if [ ! -f "$APKS_FILE" ]; then
        print_error "APKs file not found: $APKS_FILE"
        print_info "Please run 'build' command first"
        exit 1
    fi
}

# Check for connected devices
check_device_connected() {
    if ! adb devices | grep -q "device$"; then
        print_error "No Android device/emulator connected"
        print_info "Connect a device or start an emulator first"
        exit 1
    fi
}

# Setup - download bundletool if missing
setup_bundletool() {
    if [ -f "$BUNDLETOOL_JAR" ]; then
        print_success "bundletool already installed at: $BUNDLETOOL_JAR"
        return 0
    fi

    print_info "Downloading bundletool v1.18.3..."
    if wget -q --show-progress https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar -O "$BUNDLETOOL_JAR"; then
        print_success "bundletool downloaded successfully!"
        print_info "Location: $BUNDLETOOL_JAR"
    else
        print_error "Failed to download bundletool"
        print_info "Please download manually from: https://github.com/google/bundletool/releases"
        exit 1
    fi
}

# Build APKs from AAB
build_apks() {
    local mode="${1:-split}"
    local local_testing="--local-testing"

    check_bundletool_exists
    check_aab_exists

    if [[ "$@" == *"--no-local-testing"* ]]; then
        local_testing=""
    fi

    print_info "Building $mode APKs from AAB..."
    print_info "AAB: $AAB_FILE"
    print_info "Output: $APKS_FILE"

    if [ "$mode" = "universal" ]; then
        java -jar "$BUNDLETOOL_JAR" build-apks \
            --bundle="$AAB_FILE" \
            --output="$APKS_FILE" \
            --mode=universal \
            $local_testing
    else
        java -jar "$BUNDLETOOL_JAR" build-apks \
            --bundle="$AAB_FILE" \
            --output="$APKS_FILE" \
            $local_testing
    fi

    if [ -f "$APKS_FILE" ]; then
        local size=$(du -h "$APKS_FILE" | cut -f1)
        print_success "APKs built successfully! Size: $size"
    else
        print_error "Failed to build APKs"
        exit 1
    fi
}

# Install APKs to device
install_apks() {
    check_bundletool_exists
    check_apks_exists
    check_device_connected

    print_info "Installing APKs to device..."

    java -jar "$BUNDLETOOL_JAR" install-apks --apks="$APKS_FILE"

    print_success "App installed successfully!"
}

# Uninstall app from device
uninstall_app() {
    check_device_connected

    print_info "Uninstalling app from device..."

    if adb uninstall "$PACKAGE_NAME" 2>/dev/null; then
        print_success "App uninstalled successfully!"
    else
        print_warning "App not installed or uninstallation failed"
    fi
}

# Launch app on device
launch_app() {
    check_device_connected

    print_info "Launching app..."

    adb shell am start -n "$PACKAGE_NAME/.MainActivity"

    print_success "App launched!"
}

# List connected devices
list_devices() {
    print_info "Connected Android devices:"
    echo ""

    local device_count=$(adb devices | grep -c "device$" || true)

    if [ "$device_count" -eq 0 ]; then
        print_warning "No devices connected"
    else
        adb devices | grep "device$" | while read -r line; do
            local device_id=$(echo "$line" | cut -f1)
            echo "  • $device_id"
        done
        echo ""
        print_success "Found $device_count device(s)"
    fi
}

# Full workflow: build, install, launch
full_workflow() {
    print_info "Running full workflow..."

    # Check if app is already installed
    if adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
        print_warning "App is already installed. Uninstalling first..."
        uninstall_app
    fi

    build_apks split
    install_apks
    sleep 1
    launch_app

    print_success "Full workflow completed!"
}

# Clean generated files
clean_files() {
    print_info "Cleaning generated APKs files..."

    if [ -f "$APKS_FILE" ]; then
        rm -f "$APKS_FILE"
        print_success "Removed: $APKS_FILE"
    else
        print_info "No APKs files to clean"
    fi
}

# Parse arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        setup)
            COMMAND="setup"
            shift
            ;;
        build)
            COMMAND="build"
            shift
            ;;
        build-universal)
            COMMAND="build-universal"
            shift
            ;;
        install)
            COMMAND="install"
            shift
            ;;
        install-universal)
            COMMAND="install-universal"
            shift
            ;;
        uninstall)
            COMMAND="uninstall"
            shift
            ;;
        launch)
            COMMAND="launch"
            shift
            ;;
        devices)
            COMMAND="devices"
            shift
            ;;
        full)
            COMMAND="full"
            shift
            ;;
        clean)
            COMMAND="clean"
            shift
            ;;
        help|--help|-h)
            show_usage
            exit 0
            ;;
        --aab)
            AAB_FILE="$2"
            shift 2
            ;;
        --apks)
            APKS_FILE="$2"
            shift 2
            ;;
        --no-local-testing)
            # Handled in build_apks
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Execute command
if [ -z "$COMMAND" ]; then
    print_error "No command specified"
    show_usage
    exit 1
fi

case $COMMAND in
    setup)
        setup_bundletool
        ;;
    build)
        build_apks split "$@"
        ;;
    build-universal)
        build_apks universal "$@"
        ;;
    install)
        install_apks
        ;;
    install-universal)
        build_apks universal
        install_apks
        ;;
    uninstall)
        uninstall_app
        ;;
    launch)
        launch_app
        ;;
    devices)
        list_devices
        ;;
    full)
        full_workflow
        ;;
    clean)
        clean_files
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
