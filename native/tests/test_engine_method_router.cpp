// The routing policy of the RPC surface: an exact method name wins, and
// otherwise the longest registered prefix wins.

#include "test_harness.h"

#include <string>

#include "engine/engine_method_router.h"

namespace {

struct Route {
  std::string name;
};

}  // namespace

MESH_TEST(MethodRouter_ExactMatchWinsOverPrefix) {
  engine::MethodRouter<Route> router;
  router.RegisterPrefix("browser.", Route{"prefix"});
  router.RegisterExact("browser.navigate", Route{"exact"});

  const Route* route = router.Match("browser.navigate");

  MESH_CHECK(route != nullptr);
  MESH_CHECK_EQ(route->name, std::string("exact"));
}

MESH_TEST(MethodRouter_LongestPrefixWins) {
  engine::MethodRouter<Route> router;
  router.RegisterPrefix("a.", Route{"short"});
  router.RegisterPrefix("a.b.", Route{"long"});

  const Route* route = router.Match("a.b.c");

  MESH_CHECK(route != nullptr);
  MESH_CHECK_EQ(route->name, std::string("long"));
}

MESH_TEST(MethodRouter_UnmatchedMethodHasNoRoute) {
  engine::MethodRouter<Route> router;
  router.RegisterExact("browser.navigate", Route{"exact"});
  router.RegisterPrefix("git.", Route{"prefix"});

  MESH_CHECK(router.Match("library.list") == nullptr);
}

MESH_TEST(MethodRouter_PrefixMatchesFromTheStartOnly) {
  engine::MethodRouter<Route> router;
  router.RegisterPrefix("git.", Route{"prefix"});

  MESH_CHECK(router.Match("git.status") != nullptr);
  MESH_CHECK(router.Match("app.git.status") == nullptr);
}

MESH_TEST(MethodRouter_LastExactRegistrationWins) {
  engine::MethodRouter<Route> router;
  router.RegisterExact("browser.navigate", Route{"first"});
  router.RegisterExact("browser.navigate", Route{"second"});

  const Route* route = router.Match("browser.navigate");

  MESH_CHECK(route != nullptr);
  MESH_CHECK_EQ(route->name, std::string("second"));
}

MESH_TEST(MethodRouter_KeepsEveryPrefixRegistration) {
  engine::MethodRouter<Route> router;
  router.RegisterPrefix("a.", Route{"first"});
  router.RegisterPrefix("a.", Route{"second"});

  MESH_CHECK_EQ(router.prefix_routes().size(), static_cast<size_t>(2));
}
