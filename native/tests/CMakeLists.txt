# Unit tests for the engine logic that does not depend on CEF.
#
# The target deliberately links no CEF library: it is built from the
# CEF-free engine sources only, so a test run never needs Chromium.
# It can also be configured on its own, without the browser:
#
#   cmake -S native/tests -B build-tests
#   cmake --build build-tests
#   ./build-tests/mesh_engine_tests

if(CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  cmake_minimum_required(VERSION 3.21)
  project(MeshEngineTests LANGUAGES CXX)
  set(CMAKE_CXX_STANDARD 17)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
endif()

set(MESH_ENGINE_TEST_SRCS
  test_main.cpp
  test_engine_app_menu_anchor.cpp
  test_engine_app_menu_dismissal.cpp
  test_engine_keyboard_policy.cpp
  test_engine_method_router.cpp
  test_engine_native_menu_tracker.cpp
  test_engine_runtime_policy.cpp
  test_engine_settings_plan.cpp
  test_profile_paths.cpp
  test_legacy_migration.cpp
  test_product_identity.cpp
)

add_executable(mesh_engine_tests
  ${MESH_ENGINE_TEST_SRCS}
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_app_menu_anchor.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_app_menu_dismissal.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_keyboard_policy.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_native_menu_tracker.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_runtime_policy.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/engine/engine_settings_plan.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/profile/profile_paths.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/profile/profile_state.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/profile/launch_options.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/profile/legacy_migration.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/../src/platform/utf8.cpp
)

target_include_directories(mesh_engine_tests PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/../include"
)

# The native menu tracker uses the common-controls subclassing API on
# Windows. It is not part of the default C++ libraries, so link it
# explicitly there; other platforms need nothing extra.
if(WIN32)
  target_link_libraries(mesh_engine_tests PRIVATE comctl32)
endif()

# Run the suite through ctest as well as directly.
enable_testing()
add_test(NAME mesh_engine_tests COMMAND mesh_engine_tests)
