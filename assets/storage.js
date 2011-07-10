var storage={};
storage.repos={};


storage.repos.list=function(success){
    var url = "/user/repos";
   
    $.get(url,success,"json")
}
