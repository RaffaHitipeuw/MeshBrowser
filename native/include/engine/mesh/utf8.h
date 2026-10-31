#pragma once

#include <string>

namespace mesh::utf8 {

std::string Narrow(const std::wstring& wide);
std::wstring Widen(const std::string& utf8);

}  // namespace mesh::utf8
