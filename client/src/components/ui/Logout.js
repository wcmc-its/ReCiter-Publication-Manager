import React from 'react';

const Logout = () => {
    function delete_cookie( name ) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }
    delete_cookie('reciter-session')
    window.location.replace('/login')
    return (
        <div>
            Please wait while we log you out
        </div>
    )
}

export default Logout;