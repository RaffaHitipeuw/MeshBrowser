#include "test_harness.h"

#include <cstdio>
#include <string>

namespace mesh_test {
namespace {

int g_failures = 0;

}  // namespace

std::vector<TestCase>& Registry() {
  static std::vector<TestCase> registry;
  return registry;
}

bool Register(const char* name, void (*fn)()) {
  Registry().push_back(TestCase{name, fn});
  return true;
}

void Fail(const char* file, int line, const std::string& message) {
  ++g_failures;
  std::fprintf(stderr, "    %s:%d: %s\n", file, line, message.c_str());
}

int RunAll() {
  int failed_tests = 0;
  for (const auto& test : Registry()) {
    const int before = g_failures;
    std::printf("[ RUN      ] %s\n", test.name);
    test.fn();
    if (g_failures > before) {
      ++failed_tests;
      std::printf("[  FAILED  ] %s\n", test.name);
    } else {
      std::printf("[       OK ] %s\n", test.name);
    }
  }
  std::printf("\n%zu test(s), %d failed, %d failed check(s)\n",
              Registry().size(), failed_tests, g_failures);
  return failed_tests == 0 ? 0 : 1;
}

}  // namespace mesh_test

int main() {
  return mesh_test::RunAll();
}
