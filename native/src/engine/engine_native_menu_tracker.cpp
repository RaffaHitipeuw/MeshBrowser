#include "engine/engine_native_menu_tracker.h"

#if defined(_WIN32)
#include <windows.h>
#include <commctrl.h>

#include <cstdint>
#include <string>
#include <vector>
#endif

namespace engine {

namespace {

// The tracker the platform layer notifies. It is platform-independent
// state: the tracker is installed and removed on every platform, only the
// native-menu bookkeeping behind it is Windows-only.
NativeMenuTracker* g_tracker = nullptr;

}  // namespace

#if defined(_WIN32)
namespace {

HWND g_root_menu_hwnd = nullptr;
HWINEVENTHOOK g_submenu_hook = nullptr;
HHOOK g_menu_cbt = nullptr;
HWND g_main_hwnd = nullptr;
HWND g_pending_submenu = nullptr;
UINT_PTR g_submenu_timer = 0;
UINT_PTR g_menu_poll_timer = 0;

void LogMsg(const std::string& message) {
  if (g_tracker && g_tracker->callbacks().log) {
    g_tracker->callbacks().log(message);
  }
}

void NotifyPopupCreated(HWND hwnd) {
  if (!g_tracker) {
    return;
  }
  // Copy the callback: the product may tear the tracker down from inside it.
  auto callback = g_tracker->callbacks().on_popup_created;
  if (callback) {
    callback(hwnd);
  }
}

void NotifyMenuClosed() {
  if (!g_tracker) {
    return;
  }
  // Copy the callback: the product reacts to the dismissal by removing the
  // tracker, which would destroy the callback while it is running.
  auto callback = g_tracker->callbacks().on_menu_closed;
  if (callback) {
    callback();
  }
}

bool IsForeignWindow(HWND hwnd) {
  if (!g_tracker || !g_tracker->callbacks().is_foreign_window) {
    return false;
  }
  return g_tracker->callbacks().is_foreign_window(hwnd);
}

bool IsMenuPopup(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd) || hwnd == g_main_hwnd) {
    return false;
  }
  wchar_t cls[64] = {};
  if (GetClassNameW(hwnd, cls, 64) <= 0) {
    return false;
  }
  if (wcscmp(cls, L"tooltips_class32") == 0) {
    return false;
  }
  // Product-owned windows (overlays) are not menu popups.
  if (IsForeignWindow(hwnd)) {
    return false;
  }
  LONG_PTR style = GetWindowLongPtrW(hwnd, GWL_STYLE);
  if (!(style & WS_POPUP)) {
    return false;
  }
  RECT rc = {};
  GetWindowRect(hwnd, &rc);
  if ((rc.right - rc.left) < 30 || (rc.bottom - rc.top) < 30) {
    return false;
  }
  return true;
}

LRESULT CALLBACK SubmenuSubclassProc(HWND hwnd,
                                     UINT msg,
                                     WPARAM wparam,
                                     LPARAM lparam,
                                     UINT_PTR subclass_id,
                                     DWORD_PTR ref_data) {
  if (msg == WM_WINDOWPOSCHANGING) {
    auto* pos = reinterpret_cast<WINDOWPOS*>(lparam);
    if (pos) {
      HWND root = g_root_menu_hwnd;
      if (root && IsWindow(root) && hwnd != root) {
        RECT root_rc = {};
        if (GetWindowRect(root, &root_rc)) {
          if (pos->x >= root_rc.right - 32) {
            int width = pos->cx > 0 ? pos->cx : static_cast<int>(ref_data);
            if (width <= 0) {
              RECT rc = {};
              GetWindowRect(hwnd, &rc);
              width = rc.right - rc.left;
            }
            if (width <= 0) {
              width = 150;
            }
            int target_x = root_rc.left - width + 4;
            HMONITOR mon = MonitorFromWindow(root, MONITOR_DEFAULTTONEAREST);
            MONITORINFO mi = {};
            mi.cbSize = sizeof(mi);
            if (GetMonitorInfoW(mon, &mi) && target_x < mi.rcWork.left) {
              target_x = mi.rcWork.left;
            }
            pos->x = target_x;
            pos->flags &= ~SWP_NOMOVE;
          }
        }
      }
    }
  } else if (msg == WM_NCDESTROY) {
    RemoveWindowSubclass(hwnd, SubmenuSubclassProc, subclass_id);
  }
  return DefSubclassProc(hwnd, msg, wparam, lparam);
}

void RepositionSubmenuToLeft(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) {
    return;
  }
  HWND root = g_root_menu_hwnd;
  if (!root || root == hwnd || !IsWindow(root)) {
    return;
  }
  RECT child_rc = {};
  RECT root_rc = {};
  if (!GetWindowRect(hwnd, &child_rc) || !GetWindowRect(root, &root_rc)) {
    return;
  }
  const int width = child_rc.right - child_rc.left;
  if (width <= 0) {
    return;
  }
  // If the submenu is on the right side of the parent menu, flip it inward to the left.
  if (child_rc.left >= root_rc.right - 32) {
    int target_x = root_rc.left - width + 4;
    HMONITOR mon = MonitorFromWindow(root, MONITOR_DEFAULTTONEAREST);
    MONITORINFO mi = {};
    mi.cbSize = sizeof(mi);
    if (GetMonitorInfoW(mon, &mi)) {
      if (target_x < mi.rcWork.left) {
        target_x = mi.rcWork.left;
      }
    }
    LogMsg("RepositionSubmenuToLeft: moving hwnd=" +
           std::to_string(reinterpret_cast<uintptr_t>(hwnd)) +
           " from x=" + std::to_string(child_rc.left) +
           " to left target_x=" + std::to_string(target_x));
    SetWindowPos(hwnd, nullptr, target_x, child_rc.top, 0, 0,
                 SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    SetWindowSubclass(hwnd, SubmenuSubclassProc, 1001, static_cast<DWORD_PTR>(width));
  }
}

VOID CALLBACK MenuPollTimerProc(HWND, UINT, UINT_PTR, DWORD) {
  struct PopupInfo {
    HWND hwnd;
    RECT rc;
  };
  std::vector<PopupInfo> popups;

  EnumThreadWindows(
      GetCurrentThreadId(),
      [](HWND h, LPARAM lp) -> BOOL {
        auto* list = reinterpret_cast<std::vector<PopupInfo>*>(lp);
        if (IsMenuPopup(h)) {
          RECT rc = {};
          GetWindowRect(h, &rc);
          list->push_back({h, rc});
        }
        return TRUE;
      },
      reinterpret_cast<LPARAM>(&popups));

  if (popups.empty()) {
    if (g_root_menu_hwnd != nullptr) {
      g_root_menu_hwnd = nullptr;
      NotifyMenuClosed();
    }
    return;
  }

  HWND root = g_root_menu_hwnd;
  if (!root || !IsWindow(root)) {
    if (popups.size() == 1) {
      g_root_menu_hwnd = popups[0].hwnd;
      root = g_root_menu_hwnd;
    } else if (popups.size() >= 2) {
      // Pick the taller one as the main root menu
      if ((popups[0].rc.bottom - popups[0].rc.top) >=
          (popups[1].rc.bottom - popups[1].rc.top)) {
        g_root_menu_hwnd = popups[0].hwnd;
      } else {
        g_root_menu_hwnd = popups[1].hwnd;
      }
      root = g_root_menu_hwnd;
    }
  }

  if (!root || !IsWindow(root)) {
    return;
  }

  RECT root_rc = {};
  if (!GetWindowRect(root, &root_rc)) {
    return;
  }

  for (const auto& item : popups) {
    if (item.hwnd != root) {
      if (item.rc.left >= root_rc.right - 32) {
        int width = item.rc.right - item.rc.left;
        int target_x = root_rc.left - width + 4;
        HMONITOR mon = MonitorFromWindow(root, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = {};
        mi.cbSize = sizeof(mi);
        if (GetMonitorInfoW(mon, &mi)) {
          if (target_x < mi.rcWork.left) {
            target_x = mi.rcWork.left;
          }
        }
        LogMsg("MenuPollTimer: flipping submenu hwnd=" +
               std::to_string(reinterpret_cast<uintptr_t>(item.hwnd)) +
               " from x=" + std::to_string(item.rc.left) +
               " to left target_x=" + std::to_string(target_x));
        SetWindowPos(item.hwnd, nullptr, target_x, item.rc.top, 0, 0,
                     SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
        SetWindowSubclass(item.hwnd, SubmenuSubclassProc, 1001,
                          static_cast<DWORD_PTR>(width));
      }
    }
  }
}

VOID CALLBACK SubmenuFlipTimer(HWND, UINT, UINT_PTR id, DWORD) {
  KillTimer(nullptr, id);
  if (g_submenu_timer == id) {
    g_submenu_timer = 0;
  }
  if (g_pending_submenu) {
    RepositionSubmenuToLeft(g_pending_submenu);
    g_pending_submenu = nullptr;
  }
}

LRESULT CALLBACK MenuCbtProc(int code, WPARAM wParam, LPARAM lParam) {
  if (code == HCBT_CREATEWND) {
    HWND hwnd = reinterpret_cast<HWND>(wParam);
    auto* created = reinterpret_cast<CBT_CREATEWNDW*>(lParam);
    const wchar_t* cls = nullptr;
    wchar_t name[64] = {};
    if (created && created->lpcs && created->lpcs->lpszClass &&
        !IS_INTRESOURCE(created->lpcs->lpszClass)) {
      cls = created->lpcs->lpszClass;
    } else if (hwnd && GetClassNameW(hwnd, name, 64) > 0) {
      cls = name;
    }
    bool is_menu_class = false;
    if (cls) {
      if (wcscmp(cls, L"#32768") == 0 ||
          wcsncmp(cls, L"Chrome_WidgetWin", 16) == 0) {
        is_menu_class = true;
      }
    }
    if (is_menu_class && hwnd != g_main_hwnd) {
      DWORD style = (created && created->lpcs) ? created->lpcs->style : 0;
      bool is_popup = (style & WS_POPUP) && !(style & WS_CAPTION) && !(style & WS_CHILD);
      if (!is_popup && hwnd) {
        DWORD cur_style = static_cast<DWORD>(GetWindowLongPtrW(hwnd, GWL_STYLE));
        is_popup = (cur_style & WS_POPUP) && !(cur_style & WS_CAPTION) && !(cur_style & WS_CHILD);
      }
      if (is_popup) {
        if (cls && wcscmp(cls, L"#32768") == 0) {
          NotifyPopupCreated(hwnd);
        }
        if (!g_root_menu_hwnd || !IsWindow(g_root_menu_hwnd)) {
          g_root_menu_hwnd = hwnd;
        } else if (hwnd != g_root_menu_hwnd) {
          int init_width = (created && created->lpcs) ? created->lpcs->cx : 0;
          SetWindowSubclass(hwnd, SubmenuSubclassProc, 1001, static_cast<DWORD_PTR>(init_width));
        }
      }
    }
  }
  return CallNextHookEx(g_menu_cbt, code, wParam, lParam);
}

void CALLBACK SubmenuWinEvent(HWINEVENTHOOK,
                              DWORD event,
                              HWND hwnd,
                              LONG id_object,
                              LONG,
                              DWORD,
                              DWORD) {
  if (event != EVENT_OBJECT_SHOW || !hwnd) {
    return;
  }
  if (!IsMenuPopup(hwnd)) {
    return;
  }
  wchar_t cls[64] = {};
  if (GetClassNameW(hwnd, cls, 64) > 0 && wcscmp(cls, L"#32768") == 0) {
    NotifyPopupCreated(hwnd);
  }
  if (!g_root_menu_hwnd || !IsWindow(g_root_menu_hwnd)) {
    g_root_menu_hwnd = hwnd;
    return;
  }
  if (hwnd == g_root_menu_hwnd) {
    return;
  }
  SetWindowSubclass(hwnd, SubmenuSubclassProc, 1001, 0);
  RepositionSubmenuToLeft(hwnd);
  g_pending_submenu = hwnd;
  if (g_submenu_timer) {
    KillTimer(nullptr, g_submenu_timer);
  }
  g_submenu_timer = SetTimer(nullptr, 0, 16, SubmenuFlipTimer);
}

}  // namespace
#endif  // _WIN32

NativeMenuTracker& NativeMenuTracker::Get() {
  static NativeMenuTracker instance;
  return instance;
}

void NativeMenuTracker::Install(void* main_window, Callbacks callbacks) {
  callbacks_ = std::move(callbacks);
  main_window_ = main_window;
#if defined(_WIN32)
  g_tracker = this;
  g_main_hwnd = static_cast<HWND>(main_window);
  g_root_menu_hwnd = nullptr;
  g_pending_submenu = nullptr;
  if (!g_menu_poll_timer) {
    g_menu_poll_timer = SetTimer(nullptr, 0, 15, MenuPollTimerProc);
  }
  if (!g_submenu_hook) {
    g_submenu_hook = SetWinEventHook(
        EVENT_OBJECT_SHOW, EVENT_OBJECT_SHOW, nullptr, SubmenuWinEvent,
        GetCurrentProcessId(), 0, WINEVENT_OUTOFCONTEXT);
  }
  if (!g_menu_cbt) {
    g_menu_cbt = SetWindowsHookExW(WH_CBT, MenuCbtProc, nullptr,
                                   GetCurrentThreadId());
  }
#endif
}

void NativeMenuTracker::Remove() {
#if defined(_WIN32)
  if (g_menu_poll_timer) {
    KillTimer(nullptr, g_menu_poll_timer);
    g_menu_poll_timer = 0;
  }
  if (g_submenu_timer) {
    KillTimer(nullptr, g_submenu_timer);
    g_submenu_timer = 0;
  }
  g_pending_submenu = nullptr;
  g_root_menu_hwnd = nullptr;
  g_main_hwnd = nullptr;
  if (g_menu_cbt) {
    UnhookWindowsHookEx(g_menu_cbt);
    g_menu_cbt = nullptr;
  }
  if (g_submenu_hook) {
    UnhookWinEvent(g_submenu_hook);
    g_submenu_hook = nullptr;
  }
#endif
  g_tracker = nullptr;
  main_window_ = nullptr;
  callbacks_ = Callbacks();
}

bool NativeMenuTracker::root_menu_visible() const {
#if defined(_WIN32)
  HWND root = g_root_menu_hwnd;
  return root && IsWindow(root) && IsWindowVisible(root);
#else
  return false;
#endif
}

bool NativeMenuTracker::root_menu_present() const {
#if defined(_WIN32)
  return g_root_menu_hwnd != nullptr;
#else
  return false;
#endif
}

}  // namespace engine
