#pragma once

#include <algorithm>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace engine {

/**
 * The routing policy of an RPC surface.
 *
 * The engine owns the *rule* that maps a method name onto a route: an
 * exact method name always wins, and otherwise the longest registered
 * prefix wins. What a route actually does is the product's business, so
 * the table is generic over the route payload and knows nothing about any
 * product type.
 *
 * The header is CEF-free on purpose: the policy is pure string handling
 * and is unit-tested without linking Chromium.
 */
template <typename Route>
class MethodRouter {
 public:
  /** Registers a route that matches one exact method name. */
  void RegisterExact(std::string method, Route route) {
    exact_[std::move(method)] = std::move(route);
  }

  /** Registers a route that matches every method name with this prefix. */
  void RegisterPrefix(std::string prefix, Route route) {
    prefixes_.emplace_back(std::move(prefix), std::move(route));
    // Longest prefix first: the most specific domain wins.
    std::sort(prefixes_.begin(), prefixes_.end(),
              [](const auto& a, const auto& b) {
                return a.first.size() > b.first.size();
              });
  }

  /**
   * Resolves a method name: exact match first, then the longest matching
   * prefix. Returns nullptr when nothing matches.
   */
  const Route* Match(std::string_view method) const {
    const auto exact = exact_.find(std::string(method));
    if (exact != exact_.end()) {
      return &exact->second;
    }
    for (const auto& entry : prefixes_) {
      if (method.rfind(entry.first, 0) == 0) {
        return &entry.second;
      }
    }
    return nullptr;
  }

  /** All exact routes, keyed by method name. */
  const std::unordered_map<std::string, Route>& exact_routes() const {
    return exact_;
  }

  /** All prefix routes, longest prefix first. */
  const std::vector<std::pair<std::string, Route>>& prefix_routes() const {
    return prefixes_;
  }

 private:
  std::unordered_map<std::string, Route> exact_;
  std::vector<std::pair<std::string, Route>> prefixes_;
};

}  // namespace engine
