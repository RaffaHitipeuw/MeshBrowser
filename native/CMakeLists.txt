set(MESH_TARGET MeshBrowser)

# Bake the repo UI path into the binary for live reload during development.
file(TO_NATIVE_PATH "${CMAKE_SOURCE_DIR}/ui" MESH_UI_SOURCE_DIR)
configure_file(
  "${CMAKE_CURRENT_SOURCE_DIR}/include/mesh/build_config.h.in"
  "${CMAKE_CURRENT_BINARY_DIR}/generated/mesh/build_config.h"
  @ONLY
)

add_library(mesh_sqlite STATIC "${CMAKE_SOURCE_DIR}/third_party/sqlite/sqlite3.c")
target_include_directories(mesh_sqlite PUBLIC "${CMAKE_SOURCE_DIR}/third_party/sqlite")
target_compile_definitions(mesh_sqlite PRIVATE SQLITE_THREADSAFE=1)
if(MSVC)
  target_compile_options(mesh_sqlite PRIVATE /W0)
  target_compile_options(mesh_sqlite PRIVATE
    $<$<CONFIG:Debug>:/MTd>
    $<$<CONFIG:Release>:/MT>
    $<$<CONFIG:>:/MT>
  )
endif()

# Brave adblock-rust via C FFI (requires Rust/cargo on PATH).
find_program(MESH_CARGO cargo REQUIRED)
set(MESH_ADBLOCK_FFI_DIR "${CMAKE_CURRENT_SOURCE_DIR}/adblock_ffi")
set(MESH_ADBLOCK_FFI_TARGET_DIR "${CMAKE_CURRENT_BINARY_DIR}/adblock_ffi_target")
# Always release for the adblock staticlib (perf + smaller deps). Multi-config
# generators (Visual Studio) leave CMAKE_BUILD_TYPE empty.
set(MESH_ADBLOCK_PROFILE "release")
if(WIN32)
  set(MESH_ADBLOCK_LIB
    "${MESH_ADBLOCK_FFI_TARGET_DIR}/${MESH_ADBLOCK_PROFILE}/mesh_adblock_ffi.lib")
else()
  set(MESH_ADBLOCK_LIB
    "${MESH_ADBLOCK_FFI_TARGET_DIR}/${MESH_ADBLOCK_PROFILE}/libmesh_adblock_ffi.a")
endif()
add_custom_command(
  OUTPUT "${MESH_ADBLOCK_LIB}"
  COMMAND ${CMAKE_COMMAND} -E env
          "CARGO_TARGET_DIR=${MESH_ADBLOCK_FFI_TARGET_DIR}"
          ${MESH_CARGO} build --release
          --manifest-path "${MESH_ADBLOCK_FFI_DIR}/Cargo.toml"
  WORKING_DIRECTORY "${MESH_ADBLOCK_FFI_DIR}"
  DEPENDS
    "${MESH_ADBLOCK_FFI_DIR}/src/lib.rs"
    "${MESH_ADBLOCK_FFI_DIR}/Cargo.toml"
    "${MESH_ADBLOCK_FFI_DIR}/include/mesh_adblock.h"
  COMMENT "Building mesh_adblock_ffi (adblock-rust)"
  VERBATIM
)
add_custom_target(mesh_adblock_ffi_build DEPENDS "${MESH_ADBLOCK_LIB}")
add_library(mesh_adblock_ffi STATIC IMPORTED GLOBAL)
set_target_properties(mesh_adblock_ffi PROPERTIES
  IMPORTED_LOCATION "${MESH_ADBLOCK_LIB}"
)
add_dependencies(mesh_adblock_ffi mesh_adblock_ffi_build)

if(WIN32)
  set(MESH_MAIN_SRC src/main_win.cpp)
else()
  set(MESH_MAIN_SRC src/main_linux.cpp)
endif()

set(MESH_SRCS
  ${MESH_MAIN_SRC}
  src/app/mesh_app.cpp
  src/app/mesh_handler.cpp
  src/app/ai_hud.cpp
  src/app/app_menu.cpp
  src/app/scrollbar_inject.cpp
  src/adblock/adblock_service.cpp
  src/adblock/adblock_resource_handler.cpp
  src/api/api_dispatcher.cpp
  src/api/api_access.cpp
  src/api/register_apis.cpp
  src/api/handlers/platform_api.cpp
  src/api/handlers/adblock_api.cpp
  src/api/handlers/browser_api.cpp
  src/api/handlers/window_api.cpp
  src/api/handlers/library_api.cpp
  src/api/handlers/terminal_api.cpp
  src/api/handlers/git_api.cpp
  src/api/handlers/agent_api.cpp
  src/api/devtools_client.cpp
  src/ipc/library_ipc.cpp
  src/ipc/library_commands.cpp
  src/ipc/library_json.cpp
  src/ipc/window_commands.cpp
  src/ipc/browser_commands.cpp
  src/ipc/terminal_commands.cpp
  src/ipc/git_commands.cpp
  src/terminal/terminal_manager.cpp

  src/library/library_repository.cpp
  src/library/history_store.cpp
  src/library/bookmark_store.cpp
  src/library/download_store.cpp
  src/library/settings_store.cpp
  src/library/session_store.cpp
  src/library/plugin_registry.cpp
  src/launch/game_launcher.cpp
  src/profile/profile_paths.cpp
  src/profile/profile_state.cpp
  src/profile/launch_options.cpp
  src/profile/legacy_migration.cpp
  src/platform/paths.cpp
  src/platform/file_dialog.cpp
  src/platform/utf8.cpp
  src/platform/appearance.cpp
  src/dev/dev_mode.cpp
  src/dev/ui_hot_reload.cpp
  src/mcp/mcp_server.cpp
  src/mcp/mcp_http_server.cpp

  # MeshBrowser: product-agnostic browser mechanics.
  src/engine/engine_app.cpp
  src/engine/engine_app_menu.cpp
  src/engine/engine_app_menu_anchor.cpp
  src/engine/engine_app_menu_dismissal.cpp
  src/engine/engine_keyboard_policy.cpp
  src/engine/engine_native_menu_tracker.cpp
  src/engine/engine_runtime_policy.cpp
  src/engine/engine_settings.cpp
  src/engine/engine_settings_plan.cpp
  src/engine/engine_window_delegate.cpp
)

ADD_LOGICAL_TARGET("libcef_lib" "${CEF_LIB_DEBUG}" "${CEF_LIB_RELEASE}")
SET_CEF_TARGET_OUT_DIR()

if(WIN32)
  list(APPEND MESH_SRCS win/app.rc)
endif()

if(WIN32)
  add_executable(${MESH_TARGET} WIN32 ${MESH_SRCS})
else()
  add_executable(${MESH_TARGET} ${MESH_SRCS})
endif()
SET_EXECUTABLE_TARGET_PROPERTIES(${MESH_TARGET})
add_dependencies(${MESH_TARGET} libcef_dll_wrapper mesh_adblock_ffi)

target_include_directories(${MESH_TARGET} PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/include"
  "${CMAKE_CURRENT_SOURCE_DIR}/include/engine"
  "${CMAKE_CURRENT_SOURCE_DIR}/adblock_ffi/include"
  "${CMAKE_SOURCE_DIR}/third_party"
  "${CMAKE_CURRENT_BINARY_DIR}/generated"
  "${CEF_INCLUDE_PATH}"
)

target_compile_definitions(${MESH_TARGET} PRIVATE
  JSON_NOEXCEPTION=1
)
if(WIN32)
  target_compile_definitions(${MESH_TARGET} PRIVATE UNICODE _UNICODE)
endif()

target_link_libraries(${MESH_TARGET}
  libcef_lib
  libcef_dll_wrapper
  mesh_sqlite
  mesh_adblock_ffi
  ${CEF_STANDARD_LIBS}
)
if(WIN32)
  target_link_libraries(${MESH_TARGET}
    comdlg32
    comctl32
    winhttp
    ws2_32
    userenv
    ntdll
    bcrypt
    iphlpapi
    gdiplus
  )
  ADD_WINDOWS_MANIFEST("${CMAKE_CURRENT_SOURCE_DIR}/win" "${MESH_TARGET}" "exe")
else()
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
  target_include_directories(${MESH_TARGET} PRIVATE ${GTK3_INCLUDE_DIRS})
  target_compile_options(${MESH_TARGET} PRIVATE ${GTK3_CFLAGS_OTHER})
  target_link_libraries(${MESH_TARGET}
    ${GTK3_LIBRARIES}
    pthread
    dl
    m
    X11
    util
  )
  set_target_properties(${MESH_TARGET} PROPERTIES
    INSTALL_RPATH "$ORIGIN"
    BUILD_RPATH "$ORIGIN"
    BUILD_WITH_INSTALL_RPATH TRUE
  )
  if(COMMAND SET_LINUX_SUID_PERMISSIONS)
    SET_LINUX_SUID_PERMISSIONS("${MESH_TARGET}" "${CEF_TARGET_OUT_DIR}/chrome-sandbox")
  endif()
endif()

COPY_FILES("${MESH_TARGET}" "${CEF_BINARY_FILES}" "${CEF_BINARY_DIR}" "${CEF_TARGET_OUT_DIR}")
COPY_FILES("${MESH_TARGET}" "${CEF_RESOURCE_FILES}" "${CEF_RESOURCE_DIR}" "${CEF_TARGET_OUT_DIR}")

# Bundled UI for machines/CI without the source tree path.
# The React bundles (ui/js/generated/) and the HTML shells (ui/*.html) are both
# generated from ui-react/ by `npm run build:ui` before the build; the CMake
# build itself stays independent of Node.
if(NOT EXISTS "${CMAKE_SOURCE_DIR}/ui/js/generated/shell.js" OR
   NOT EXISTS "${CMAKE_SOURCE_DIR}/ui/index.html")
  message(WARNING
    "ui/index.html or ui/js/generated/shell.js is missing - run "
    "`npm install && npm run build:ui` before building, otherwise the UI "
    "will not load.")
endif()

add_custom_command(TARGET ${MESH_TARGET} POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          "${CMAKE_SOURCE_DIR}/ui"
          "${CEF_TARGET_OUT_DIR}/ui"
  COMMENT "Copying bundled UI assets"
)

# Bundled adblock lists + redirect resources (next to EXE).
add_custom_command(TARGET ${MESH_TARGET} POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          "${CMAKE_SOURCE_DIR}/resources/adblock"
          "${CEF_TARGET_OUT_DIR}/adblock"
  COMMENT "Copying bundled adblock resources"
)

set_target_properties(${MESH_TARGET} PROPERTIES
  VS_DEBUGGER_WORKING_DIRECTORY "${CEF_TARGET_OUT_DIR}"
)

if(MSVC)
  # Release PDBs so fail-fast dumps (0xC0000409) can be decoded in WinDbg/VS.
  target_link_options(${MESH_TARGET} PRIVATE
    $<$<CONFIG:Release>:/DEBUG:FULL>
    $<$<CONFIG:Release>:/OPT:REF>
    $<$<CONFIG:Release>:/OPT:ICF>
  )
endif()
