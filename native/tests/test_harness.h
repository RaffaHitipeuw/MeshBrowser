#pragma once

// A minimal test harness for the engine logic that does not depend on CEF.
//
// It has no third-party dependency: a test registers itself with MESH_TEST
// and asserts with the MESH_CHECK macros. A failing check reports the file,
// the line and the expectation, and makes the process exit non-zero.

#include <string>
#include <vector>

namespace mesh_test {

struct TestCase {
  const char* name;
  void (*fn)();
};

/** The registry of all known tests. */
std::vector<TestCase>& Registry();

/** Registers a test. Returns true so it can initialise a static. */
bool Register(const char* name, void (*fn)());

/** Records a failed expectation for the test that is running. */
void Fail(const char* file, int line, const std::string& message);

/** Runs every registered test. Returns 0 when all of them passed. */
int RunAll();

}  // namespace mesh_test

#define MESH_TEST(name)                                                   \
  static void name();                                                     \
  static const bool name##_registered = ::mesh_test::Register(#name, &name); \
  static void name()

#define MESH_CHECK(cond)                                        \
  do {                                                          \
    if (!(cond)) {                                              \
      ::mesh_test::Fail(__FILE__, __LINE__, "expected: " #cond); \
    }                                                           \
  } while (false)

#define MESH_CHECK_EQ(a, b)                                              \
  do {                                                                   \
    const auto mesh_test_a = (a);                                         \
    const auto mesh_test_b = (b);                                         \
    if (!(mesh_test_a == mesh_test_b)) {                                   \
      ::mesh_test::Fail(__FILE__, __LINE__,                               \
                       std::string("expected " #a " == " #b));           \
    }                                                                    \
  } while (false)

#define MESH_CHECK_NE(a, b)                                              \
  do {                                                                   \
    const auto mesh_test_a = (a);                                         \
    const auto mesh_test_b = (b);                                         \
    if (mesh_test_a == mesh_test_b) {                                      \
      ::mesh_test::Fail(__FILE__, __LINE__,                               \
                       std::string("expected " #a " != " #b));           \
    }                                                                    \
  } while (false)
