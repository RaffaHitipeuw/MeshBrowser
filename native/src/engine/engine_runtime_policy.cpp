#include "engine/engine_runtime_policy.h"

namespace engine {
namespace {

bool StartsWith(std::string_view value, std::string_view prefix) {
  return value.rfind(prefix, 0) == 0;
}

}  // namespace

bool IsDevToolsUrl(std::string_view url) {
  return StartsWith(url, "devtools:") || StartsWith(url, "chrome-devtools:");
}

bool IsAboutUrl(std::string_view url) {
  return url.empty() || url == "about:blank" || StartsWith(url, "about:");
}

bool ShouldOpenInContent(std::string_view url) {
  if (url.empty() || url == "about:blank") {
    return false;
  }
  // The shell stays on the local UI / data URIs only.
  if (StartsWith(url, "file:") || StartsWith(url, "data:") ||
      StartsWith(url, "chrome:") || StartsWith(url, "devtools:")) {
    return false;
  }
  return true;
}

PopupAction DecidePopupAction(std::string_view url,
                              std::string_view target_frame_name) {
  if (IsDevToolsUrl(url) || StartsWith(target_frame_name, "DevTools")) {
    return PopupAction::AllowNativeChrome;
  }
  if (!url.empty() && ShouldOpenInContent(url)) {
    return PopupAction::OpenInContentTab;
  }
  return PopupAction::Block;
}

std::string SanitizeDownloadFileName(std::string_view name) {
  std::string out(name);
  for (char& c : out) {
    if (c == '/' || c == '\\' || c == ':' || c == '*' || c == '?' || c == '"' ||
        c == '<' || c == '>' || c == '|') {
      c = '_';
    }
  }
  return out;
}

}  // namespace engine
